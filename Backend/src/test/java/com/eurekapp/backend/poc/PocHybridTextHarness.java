package com.eurekapp.backend.poc;

import com.eurekapp.backend.service.client.OpenAiEmbeddingModelService;
import com.eurekapp.backend.service.client.WeaviateService;
import com.eurekapp.backend.util.TextNormalizer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.weaviate.client.Config;
import io.weaviate.client.WeaviateClient;
import io.weaviate.client.base.Result;
import io.weaviate.client.v1.data.model.WeaviateObject;
import io.weaviate.client.v1.graphql.model.GraphQLResponse;
import org.springframework.web.client.RestClient;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Infraestructura compartida de la PoC EU-142 (#9). No es un test en sí: agrupa el armado de los
 * clientes reales (OpenAI para el embedding denso, Weaviate para almacenar/consultar) y la carga del
 * mini-corpus, para que el harness de comparación (#9.5) se concentre en correr las consultas.
 *
 * A propósito NO usa el contexto de Spring: construye a mano los dos clientes (el config productivo
 * es @Profile("!test") y levantar el perfil local arrastraría MySQL y toda la app). Igual ejercita
 * el código que sobrevive a la #8: {@link TextNormalizer}, {@link OpenAiEmbeddingModelService} y
 * {@link WeaviateService}.
 */
class PocHybridTextHarness {

    static final String CLASS_NAME = "PocTextObject";
    static final String TEXT_VECTOR = "text";
    static final String WEAVIATE_HOST = "localhost:8081";
    static final String OPENAI_URL = "https://api.openai.com/v1/";
    static final String CORPUS_RESOURCE = "/poc-hybrid-text/corpus.json";

    private final OpenAiEmbeddingModelService embeddingService;
    final WeaviateService weaviateService;
    final WeaviateClient weaviateClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    PocHybridTextHarness(String openAiApiKey) {
        RestClient embeddingClient = RestClient.builder()
                .baseUrl(OPENAI_URL + "embeddings")
                .defaultHeader("Authorization", String.format("Bearer %s", openAiApiKey))
                .build();
        this.embeddingService = new OpenAiEmbeddingModelService(embeddingClient, objectMapper);

        Map<String, String> headers = Map.of("Content-Type", "application/json");
        this.weaviateClient = new WeaviateClient(new Config("http", WEAVIATE_HOST, headers));
        this.weaviateService = new WeaviateService(weaviateClient);
    }

    /** true si Weaviate responde y la clase PoC existe (schema creado por create-poc-schema.sh). */
    boolean isReady() {
        Result<Boolean> ready = weaviateClient.misc().readyChecker().run();
        if (ready.hasErrors() || !Boolean.TRUE.equals(ready.getResult())) {
            return false;
        }
        return weaviateClient.schema().classGetter().withClassName(CLASS_NAME).run().getResult() != null;
    }

    /**
     * Normaliza (#9.1) el texto de la publicación igual que lo haría el backend en producción y
     * devuelve su embedding denso de OpenAI. Se usa tanto para cargar el corpus como para armar las
     * queries, garantizando que ambos lados pasen por la MISMA normalización.
     */
    List<Float> embedNormalized(String rawText) {
        return embeddingService.getTextVectorRepresentation(TextNormalizer.normalize(rawText));
    }

    /**
     * Deja la clase PoC con exactamente los documentos del corpus: borra lo que hubiera (re-corridas
     * idempotentes) y carga cada publicación. `content` se persiste NORMALIZADO (para que el índice
     * BM25/trigram y el vector denso trabajen sobre el mismo texto que verá la query).
     *
     * @return la lista de documentos cargados (para que el harness sepa qué esperar por cada eje).
     */
    List<CorpusDoc> loadCorpus() {
        deleteAllObjects();
        List<CorpusDoc> docs = readCorpus();
        for (CorpusDoc doc : docs) {
            String rawContent = doc.title() + " " + doc.description();
            String normalizedContent = TextNormalizer.normalize(rawContent);
            List<Float> textVector = embeddingService.getTextVectorRepresentation(normalizedContent);

            Map<String, Object> props = new LinkedHashMap<>();
            props.put("content", normalizedContent);
            props.put("doc_id", doc.docId());
            props.put("role", doc.role());
            props.put("case_axis", doc.caseAxis());

            Map<String, Float[]> namedVectors = Map.of(TEXT_VECTOR, textVector.toArray(new Float[0]));
            WeaviateObject object = WeaviateObject.builder()
                    .className(CLASS_NAME)
                    .id(java.util.UUID.randomUUID().toString())
                    .properties(props)
                    .vectors(namedVectors)
                    .build();
            weaviateService.createObject(object);
        }
        return docs;
    }

    /** Cuenta los objetos de la clase PoC vía Aggregate (para verificar la carga). */
    long countObjects() {
        String query = String.format("{ Aggregate { %s { meta { count } } } }", CLASS_NAME);
        GraphQLResponse response = runGraphQL(query);
        Map<String, Object> data = (Map<String, Object>) response.getData();
        Map<String, Object> aggregate = (Map<String, Object>) data.get("Aggregate");
        List<Map<String, Object>> rows = (List<Map<String, Object>>) aggregate.get(CLASS_NAME);
        Map<String, Object> meta = (Map<String, Object>) rows.get(0).get("meta");
        return ((Number) meta.get("count")).longValue();
    }

    private void deleteAllObjects() {
        String query = String.format("{ Get { %s { _additional { id } } } }", CLASS_NAME);
        GraphQLResponse response = runGraphQL(query);
        Map<String, Object> data = (Map<String, Object>) response.getData();
        if (data == null) return;
        Map<String, Object> get = (Map<String, Object>) data.get("Get");
        List<Map<String, Object>> rows = (List<Map<String, Object>>) get.get(CLASS_NAME);
        if (rows == null) return;
        for (Map<String, Object> row : rows) {
            Map<String, Object> additional = (Map<String, Object>) row.get("_additional");
            String id = (String) additional.get("id");
            weaviateClient.data().deleter().withClassName(CLASS_NAME).withID(id).run();
        }
    }

    GraphQLResponse runGraphQL(String query) {
        Result<GraphQLResponse> result = weaviateClient.graphQL().raw().withQuery(query).run();
        if (result.hasErrors()) {
            throw new RuntimeException("GraphQL PoC falló: " + result.getError());
        }
        return result.getResult();
    }

    private List<CorpusDoc> readCorpus() {
        try (InputStream in = getClass().getResourceAsStream(CORPUS_RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException("No se encontró el corpus en " + CORPUS_RESOURCE);
            }
            JsonNode root = objectMapper.readTree(in);
            List<CorpusDoc> docs = new ArrayList<>();
            for (JsonNode node : root.get("documents")) {
                docs.add(new CorpusDoc(
                        node.get("doc_id").asText(),
                        node.get("role").asText(),
                        node.get("case_axis").asText(),
                        node.get("title").asText(),
                        node.get("description").asText()));
            }
            return docs;
        } catch (Exception e) {
            throw new RuntimeException("No se pudo leer el corpus PoC", e);
        }
    }

    /** Una publicación del corpus (título + descripción como las escribiría un usuario real). */
    record CorpusDoc(String docId, String role, String caseAxis, String title, String description) {}
}
