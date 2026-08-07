package com.eurekapp.backend.service.client;

import com.eurekapp.backend.configuration.TextClassificationProperties;
import com.eurekapp.backend.model.ObjectCategory;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests del clasificador de categoría por TEXTO (EU-337).
 *
 * <p>El proveedor de embeddings se reemplaza por uno de juguete y DETERMINISTA, para poder decidir
 * en el test qué tan parecido es cada texto a cada frase: lo que se está probando acá es la lógica
 * de decisión (mejor frase por categoría, piso de abstención, tolerancia a fallas), no la calidad
 * del modelo de OpenAI —eso se mide sobre el seed, no con tests unitarios—.</p>
 */
class EmbeddingTextClassificationServiceTest {

    private final TextClassificationProperties properties = new TextClassificationProperties();

    /**
     * Embeddings de juguete en 4 dimensiones ORTOGONALES: un eje por polo temático ("billetera",
     * "electrónica"), uno para el resto de las frases de las nubes y uno EXCLUSIVO del texto que no
     * nombra ningún objeto (lo marca la palabra "rojos", que no aparece en ninguna frase). Al ser
     * ortogonales, el coseno entre ejes distintos es 0 y cada caso es predecible a mano.
     */
    private static class FakeEmbeddings implements EmbeddingService {
        @Override
        public List<Float> getTextVectorRepresentation(String text) {
            if (text.contains("rojos")) {
                return List.of(0f, 0f, 0f, 1f);  // no se parece a NINGUNA frase: nadie llega al piso
            }
            if (text.contains("billetera") || text.contains("dni") || text.contains("monedero")
                    || text.contains("tarjeta") || text.contains("carnet") || text.contains("cedula")
                    || text.contains("documento")) {
                return List.of(1f, 0f, 0f, 0f);  // polo "billetera"
            }
            if (text.contains("celular") || text.contains("notebook") || text.contains("auriculares")
                    || text.contains("telefono") || text.contains("computadora") || text.contains("tablet")
                    || text.contains("cargador") || text.contains("bateria") || text.contains("camara")
                    || text.contains("smartwatch") || text.contains("parlante")) {
                return List.of(0f, 1f, 0f, 0f);  // polo "electronica"
            }
            return List.of(0f, 0f, 1f, 0f);      // el resto de las frases de las nubes
        }
    }

    private EmbeddingTextClassificationService serviceWith(EmbeddingService embeddings) {
        return new EmbeddingTextClassificationService(embeddings, properties);
    }

    @Test
    void classify_textThatNamesTheObject_decidesTheCategory() {
        EmbeddingTextClassificationService service = serviceWith(new FakeEmbeddings());
        assertThat(service.classify("perdí mi billetera de cuero")).isEqualTo(ObjectCategory.BILLETERA);
        assertThat(service.classify("un celular Samsung negro")).isEqualTo(ObjectCategory.ELECTRONICA);
    }

    @Test
    void classify_textThatNamesNothing_abstains() {
        // Devuelve null, NO "OTROS": OTROS es una categoría dura más, y mandar la duda ahí la haría
        // competir contra paraguas y mochilas en vez de dejar que decida la foto.
        EmbeddingTextClassificationService service = serviceWith(new FakeEmbeddings());
        assertThat(service.classify("negra con detalles rojos, la perdí en el colectivo")).isNull();
    }

    @Test
    void classify_emptyOrNullText_abstains() {
        EmbeddingTextClassificationService service = serviceWith(new FakeEmbeddings());
        assertThat(service.classify(null)).isNull();
        assertThat(service.classify("   ")).isNull();
    }

    @Test
    void classify_raisingTheFloor_makesItAbstainInsteadOfGuessing() {
        // El piso es la perilla: subirlo convierte una clasificación floja en abstención.
        properties.setMinSimilarity(1.01); // inalcanzable
        EmbeddingTextClassificationService service = serviceWith(new FakeEmbeddings());
        assertThat(service.classify("perdí mi billetera de cuero")).isNull();
    }

    @Test
    void classify_whenTheEmbeddingProviderFails_abstainsInsteadOfBreakingTheSearch() {
        // Si el proveedor se cae, la búsqueda tiene que seguir andando y decidir por la foto.
        EmbeddingTextClassificationService service = serviceWith(new EmbeddingService() {
            @Override
            public List<Float> getTextVectorRepresentation(String text) {
                throw new RuntimeException("OpenAI caído");
            }
        });
        assertThat(service.classify("perdí mi billetera de cuero")).isNull();
    }

    @Test
    void classify_vectorizesThePhraseBankOnlyOnce() {
        // Las ~50 frases de las nubes se embeben UNA vez por proceso, no en cada búsqueda.
        List<Integer> batchCalls = new ArrayList<>();
        EmbeddingService counting = new EmbeddingService() {
            private final FakeEmbeddings delegate = new FakeEmbeddings();

            @Override
            public List<Float> getTextVectorRepresentation(String text) {
                return delegate.getTextVectorRepresentation(text);
            }

            @Override
            public List<List<Float>> getTextVectorRepresentations(List<String> texts) {
                batchCalls.add(texts.size());
                return EmbeddingService.super.getTextVectorRepresentations(texts);
            }
        };
        EmbeddingTextClassificationService service = serviceWith(counting);
        service.classify("perdí mi billetera");
        service.classify("un celular negro");
        service.classify("negra con detalles rojos");
        assertThat(batchCalls).hasSize(1);
    }
}
