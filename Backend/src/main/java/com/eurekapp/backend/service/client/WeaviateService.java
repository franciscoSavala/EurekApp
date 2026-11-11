package com.eurekapp.backend.service.client;


import com.eurekapp.backend.exception.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.weaviate.client.base.WeaviateErrorMessage;
import io.weaviate.client.v1.graphql.model.GraphQLQuery;
import io.weaviate.client.v1.data.api.ObjectUpdater;
import io.weaviate.client.v1.graphql.model.GraphQLResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;


import io.weaviate.client.WeaviateClient;
import io.weaviate.client.v1.data.model.WeaviateObject;
import io.weaviate.client.base.Result;
import io.weaviate.client.v1.filters.WhereFilter;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;


@Service
public class WeaviateService {

    private static final Logger log = LoggerFactory.getLogger(WeaviateService.class);
    private final WeaviateClient weaviateClient;

    public WeaviateService(
            @Qualifier("weaviateClient") WeaviateClient weaviateClient
    ) {
        this.weaviateClient = weaviateClient;
    }

    /***
     *      Este método implementa un insert genérico para crear un objeto nuevo en Weaviate. Este método puede ser
     *      usado por el repositorio de cualquier clase.
     * ***/
    public void createObject(WeaviateObject object) {
        io.weaviate.client.v1.data.api.ObjectCreator creator = weaviateClient.data().creator()
                .withClassName(object.getClassName())
                .withID(object.getId())
                .withProperties(object.getProperties());

        // EU-323: named vectors (image/text). Si el objeto trae el mapa de vectores nombrados usamos ese;
        // en su defecto, caemos al vector único legacy (compatibilidad con clases de vector único).
        if (object.getVectors() != null && !object.getVectors().isEmpty()) {
            creator.withVectors(object.getVectors());
        } else if (object.getVector() != null) {
            creator.withVector(object.getVector());
        }

        Result<WeaviateObject> result = creator.run();
        if (result.hasErrors()) {
            log.error(result.getError().toString());
            throw new ApiException("database_error",
                    result.getError().getMessages().stream()
                            .map(WeaviateErrorMessage::toString)
                            .collect(Collectors.joining(", ")),
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /***
     *      Este método implementa un update genérico para un objeto almacenado en Weaviate. Este método puede ser usado
     *      por el repositorio de cualquier clase.
     * ***/
    public void update(String className, String id, List<Float> vector, Map<String,Object> properties){

        // Creamos un ObjectUpdater y comenzamos metiendo el nombre de clase y el id, que siempre deben ser provistos.
        ObjectUpdater updater = weaviateClient.data().updater()
                .withMerge()
                .withClassName(className)
                .withID(id);

        // Actualizar el vector solo si un vector fue provisto
        if(vector != null && !vector.isEmpty())   {updater.withVector(vector.toArray( new Float[vector.size()]));}

        // Actualizar los atributos ("properties") sólo si se recibió alguno por parámetro.
        if(properties != null && !properties.isEmpty()) {updater.withProperties(properties);}

        // Finalmente, ejecutar la actualización del objeto:
        Result response = updater.run();

        // Comprobar si la actualización fue exitosa
        if (response.hasErrors()) {
            // Manejo de errores
            System.err.println("WeaviateService: Error updating object: " + response.getError().getMessages());
        }

        System.out.println("WeaviateService: Object updated successfully.");
    }

    /***
     *      Este método implementa una query genérica a Weaviate. Este método puede ser usado por los repositorios de
     *      cualquier clase.
     * ***/
    public List<WeaviateObject> queryObjects(String className,
                                                     List<Float> vector,
                                                     String targetVector,
                                                     WhereFilter filter,
                                                     List<String> fieldNames) {
        return queryObjects(className, vector, targetVector, filter, fieldNames, null, null);
    }

    public List<WeaviateObject> queryObjects(String className,
                                                     List<Float> vector,
                                                     String targetVector,
                                                     WhereFilter filter,
                                                     List<String> fieldNames,
                                                     Integer limit,
                                                     Integer offset) {
        //Crearemos el string de la consulta GraphQL

        // 1- Nombre de la clase
        StringBuilder queryBuilder = new StringBuilder();

        queryBuilder.append("{ Get ");
        queryBuilder.append("{ ")
                .append(className).append(" ( ");

        // 2- Agregar el filtro where, si se proporciona
        if (filter != null) {
            queryBuilder.append("where: { ")
                    .append(toGraphQLString(filter))
                    .append("} ");}

        // 3- Agregar el vector, si se proporciona. EU-323: con named vectors hay que indicar contra
        //  cuál de los vectores nombrados (image/text) se busca, vía "targetVectors".
        if (vector != null && !vector.isEmpty()) {
            queryBuilder.append("nearVector: { vector: ").append(vector.toString());
            if (targetVector != null && !targetVector.isEmpty()) {
                queryBuilder.append(", targetVectors: [\"").append(targetVector).append("\"]");
            }
            queryBuilder.append(", certainty: 0.0} ");}

        // 4a- Paginación
        if (limit != null) { queryBuilder.append("limit: ").append(limit).append(" "); }
        if (offset != null && offset > 0) { queryBuilder.append("offset: ").append(offset).append(" "); }

        queryBuilder.append(")");

        // 4- Lista de atributos a incluir en la respuesta
        queryBuilder.append("{ ");
        for (String fieldName : fieldNames) {
            queryBuilder.append(fieldName).append(" ");
            if (fieldName.equals("coordinates")) {
            queryBuilder.append("{ latitude longitude }");}
        }

        // 5- Sin importar para qué clase estamos haciendo una query vectorial, siempre querremos saber el id y la
        //  cercanía de cada resultado. OJO (EU-320): sobre NAMED VECTORS (image/text), pedir el campo
        //  "certainty" ROMPE la query en Weaviate 1.24.1 ("vector config not found for target vector") y
        //  devuelve la lista vacía. Pedimos "distance" (que sí funciona) y lo convertimos a certeza coseno
        //  al parsear (certainty = 1 - distance/2), para que el resto del scoring quede idéntico.
        queryBuilder.append("_additional { id distance } ");
        queryBuilder.append("}");

        // 5- Cerrar la query
        queryBuilder.append("}}");

        log.debug("Weaviate GraphQL query: {}", queryBuilder);

        // Ejecutar la consulta GraphQL
        Result<GraphQLResponse> response = weaviateClient.graphQL().raw().withQuery(queryBuilder.toString()).run();
        //log.info(response.toString());
        /// Verificar si hay errores en la respuesta
        if (response.hasErrors()) {
            throw new RuntimeException("Error en la consulta GraphQL: " + response.getError());
        }

        // Declaramos la lista que contendrá los WeaviateObjects
        List<WeaviateObject> weaviateObjects = new ArrayList<>();
        // Extraemos los datos de la respuesta
        GraphQLResponse graphQLResponse = response.getResult();
        lanzarSiWeaviateRechazoLaConsulta(graphQLResponse);
        // Nos aseguramos de que los datos sean un Map
        if (graphQLResponse.getData() instanceof Map<?, ?>) {
            Map<String, Object> dataMap = (Map<String, Object>) graphQLResponse.getData(); // Hacer cast seguro

            // Obtenemos un map con una única key: el nombre de la clase
            Map<String, Object> objectsMap = (Map<String, Object>) dataMap.get("Get");

            // Elaboramos una lista donde cada componente es un resultado de la query
            List<Map<String,Object>> objectsList = (List<Map<String,Object>>) objectsMap.get(className);
            if (objectsList == null) {
                return weaviateObjects;
            }
            for (Map<String, Object> objectData : objectsList) {
                WeaviateObject weaviateObject = convertToWeaviateObject(objectData);
                weaviateObjects.add(weaviateObject);
            }
        } else {
            throw new RuntimeException("El formato de los datos en la respuesta no es válido.");
        }

        return weaviateObjects;
    }


    /***
     *      EU-142: búsqueda HÍBRIDA de texto (denso + BM25) en una sola query. Mientras {@link #queryObjects}
     *      compara sólo por vector (nearVector, 100% semántica), esta combina dos señales que viven en
     *      escalas distintas y Weaviate fusiona en un único `score` 0–1:
     *        - vector = embedding denso (lado semántico: "mochila roja" ≈ "bolsa bermeja"),
     *        - query  = texto crudo del usuario (lado BM25: pondera términos raros como una marca "prince"
     *                   y, con tokenización por n-gramas, tolera typos e identificadores con otro formato).
     *
     *      `alpha` ∈ [0,1] pesa las dos señales: 1 = puro denso, 0 = puro BM25 (a calibrar, EU-327).
     *      `fusionType` = "relativeScoreFusion" (reescala por valor) o "rankedFusion" (sólo por posición).
     *      El resultado pide `score` en lugar de `certainty` (el híbrido no expone certainty).
     * ***/
    public List<WeaviateObject> hybridQuery(String className,
                                            String query,
                                            List<Float> vector,
                                            String targetVector,
                                            List<String> bm25Properties,
                                            Double alpha,
                                            String fusionType,
                                            WhereFilter filter,
                                            List<String> fieldNames,
                                            Integer limit) {
        StringBuilder queryBuilder = new StringBuilder();
        queryBuilder.append("{ Get { ").append(className).append(" ( ");

        if (filter != null) {
            queryBuilder.append("where: { ").append(toGraphQLString(filter)).append("} ");
        }

        // Bloque hybrid: query (BM25) + vector (denso) + alpha + fusión. targetVectors indica contra cuál
        // de los vectores nombrados corre el lado denso; properties acota el BM25 a las propiedades de texto
        // elegidas (si no, Weaviate lo corre sobre todas las indexables, ensuciando con metadata).
        queryBuilder.append("hybrid: { query: \"").append(escapeGraphQL(query)).append("\"");
        if (vector != null && !vector.isEmpty()) {
            queryBuilder.append(", vector: ").append(vector.toString());
        }
        if (targetVector != null && !targetVector.isEmpty()) {
            queryBuilder.append(", targetVectors: [\"").append(targetVector).append("\"]");
        }
        if (bm25Properties != null && !bm25Properties.isEmpty()) {
            queryBuilder.append(", properties: [")
                    .append(bm25Properties.stream()
                            .map(p -> "\"" + p + "\"")
                            .collect(Collectors.joining(", ")))
                    .append("]");
        }
        if (alpha != null) {
            queryBuilder.append(", alpha: ").append(alpha);
        }
        if (fusionType != null && !fusionType.isEmpty()) {
            // fusionType es un enum de GraphQL: va SIN comillas.
            queryBuilder.append(", fusionType: ").append(fusionType);
        }
        queryBuilder.append(" } ");

        if (limit != null) { queryBuilder.append("limit: ").append(limit).append(" "); }
        queryBuilder.append(")");

        queryBuilder.append("{ ");
        for (String fieldName : fieldNames) {
            queryBuilder.append(fieldName).append(" ");
            if (fieldName.equals("coordinates")) {
                queryBuilder.append("{ latitude longitude }");
            }
        }
        // Con hybrid el puntaje combinado viene en `score` (no `certainty`).
        queryBuilder.append("_additional { id score } ");
        queryBuilder.append("}");
        queryBuilder.append("}}");

        Result<GraphQLResponse> response = weaviateClient.graphQL().raw().withQuery(queryBuilder.toString()).run();
        if (response.hasErrors()) {
            throw new RuntimeException("Error en la consulta híbrida GraphQL: " + response.getError());
        }

        List<WeaviateObject> weaviateObjects = new ArrayList<>();
        GraphQLResponse graphQLResponse = response.getResult();
        lanzarSiWeaviateRechazoLaConsulta(graphQLResponse);
        if (graphQLResponse.getData() instanceof Map<?, ?>) {
            Map<String, Object> dataMap = (Map<String, Object>) graphQLResponse.getData();
            Map<String, Object> objectsMap = (Map<String, Object>) dataMap.get("Get");
            List<Map<String, Object>> objectsList = (List<Map<String, Object>>) objectsMap.get(className);
            if (objectsList == null) {
                return weaviateObjects;
            }
            for (Map<String, Object> objectData : objectsList) {
                weaviateObjects.add(convertToWeaviateObject(objectData));
            }
        } else {
            throw new RuntimeException("El formato de los datos en la respuesta no es válido.");
        }

        return weaviateObjects;
    }

    /***
     *      Cuando Weaviate rechaza una consulta GraphQL (por ejemplo, una propiedad que no existe), no es un error
     *      de conexión: los errores vienen DENTRO del resultado y "data" trae la clase en null. Sin este chequeo
     *      la consulta parecería devolver una lista vacía.
     * ***/
    private static void lanzarSiWeaviateRechazoLaConsulta(GraphQLResponse graphQLResponse) {
        if (graphQLResponse.getErrors() == null || graphQLResponse.getErrors().length == 0) {
            return;
        }
        String mensajes = java.util.Arrays.stream(graphQLResponse.getErrors())
                .map(io.weaviate.client.v1.graphql.model.GraphQLError::getMessage)
                .collect(Collectors.joining(", "));
        log.error("Weaviate rechazó la consulta GraphQL: {}", mensajes);
        throw new ApiException("database_error", mensajes, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    /***
     *      Escapa comillas y barras invertidas de un texto que se inserta como literal en la query GraphQL
     *      cruda (evita romper la consulta si el usuario escribió comillas en la búsqueda).
     * ***/
    private static String escapeGraphQL(String text) {
        if (text == null) {
            return "";
        }
        return text.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    /***
     *      Dado el nombre de la clase y un UUID, devuelve el objeto correspondiente.
     * ***/
    public WeaviateObject getObjectByUuid(String className, String uuid){
        // Pedimosa WeaviateCliente que traiga el objeto en cuestión.
        Result<List<WeaviateObject>> response = weaviateClient.data().objectsGetter()
                .withClassName(className)
                .withID(uuid)
                .run();

        // Si hubo errores, retornar null.
        if (response.hasErrors()) {
            // Manejo de errores
            System.err.println("Error retrieving object: " + response.getError().getMessages());
            return null;
        }

        // Sacamos el objeto WeaviateObject de su envoltorio.
        List<WeaviateObject> objects = response.getResult();
        if (objects != null && !objects.isEmpty()) {
            return objects.get(0);
        }

        return null;
    }

    /***
     *      Cantidad máxima de ids por consulta de {@link #getObjectsByUuids}. Cada id es un operando del filtro
     *      "Or", así que se acota para no armar una query desmedida.
     * ***/
    static final int UUIDS_POR_CONSULTA = 100;

    private static final java.util.regex.Pattern UUID_PATTERN = java.util.regex.Pattern.compile(
            "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");

    /***
     *      Dado el nombre de la clase y varios UUID, devuelve los objetos que existen en una sola consulta
     *      (o en una por cada tanda de {@link #UUIDS_POR_CONSULTA}), en lugar de pedirlos de a uno.
     *
     *      Reglas que importan:
     *        - Sin límite explícito Weaviate devuelve 25 resultados (QUERY_DEFAULTS_LIMIT): por eso el límite
     *          de cada consulta es la cantidad de ids de esa tanda.
     *        - Los ids repetidos o nulos se descartan, y también los que no tienen forma de UUID (no pueden
     *          existir, y entrarían crudos a la query). Sin ids no se consulta a Weaviate.
     *        - Igual que {@link #getObjectByUuid}, si Weaviate responde con error esa tanda se da por no
     *          encontrada (queda registrado) y no se lanza excepción.
     *        - El esquema es manual: pedir un campo inexistente devuelve lista vacía SIN error, así que
     *          {@code fieldNames} debe ser exactamente un subconjunto de las propiedades de la clase.
     * ***/
    public List<WeaviateObject> getObjectsByUuids(String className, java.util.Collection<String> uuids,
                                                  List<String> fieldNames) {
        List<String> distinctUuids = uuids == null ? List.of() : uuids.stream()
                .filter(u -> u != null && UUID_PATTERN.matcher(u).matches())
                .distinct()
                .collect(Collectors.toList());

        List<WeaviateObject> found = new ArrayList<>();
        for (int from = 0; from < distinctUuids.size(); from += UUIDS_POR_CONSULTA) {
            List<String> batch = distinctUuids.subList(from, Math.min(from + UUIDS_POR_CONSULTA, distinctUuids.size()));
            WhereFilter[] operands = batch.stream()
                    .map(u -> WhereFilter.builder().path("id").operator(io.weaviate.client.v1.filters.Operator.Equal)
                            .valueText(u).build())
                    .toArray(WhereFilter[]::new);
            WhereFilter filter = operands.length == 1 ? operands[0]
                    : WhereFilter.builder().operator(io.weaviate.client.v1.filters.Operator.Or).operands(operands).build();
            try {
                found.addAll(queryObjects(className, null, null, filter, fieldNames, batch.size(), null));
            } catch (RuntimeException e) {
                // queryObjects lanza ante una respuesta con errores de Weaviate; se trata igual que en
                // getObjectByUuid: esa tanda no se encontró.
                log.warn("Weaviate respondió con error al traer {} objetos {} por id: {}",
                        batch.size(), className, e.getMessage());
            }
        }
        return found;
    }

    /***
     *      Toma un objeto WhereFilter y a partir del mismo genera el string correspondiente para poder hacer la
     *      consulta GraphQL.
     * ***/
    private static String toGraphQLString(WhereFilter filter) {
        StringBuilder stringBuilder = new StringBuilder();

        // Leaf filter (Equal, LessThan, etc.) — no tiene operandos
        if (filter.getOperands() == null || filter.getOperands().length == 0) {
            stringBuilder.append("path: [\"").append(filter.getPath()[0]).append("\"], ");
            stringBuilder.append("operator: ").append(filter.getOperator()).append(", ");
            if (filter.getValueText() != null) {
                stringBuilder.append("valueText: \"").append(filter.getValueText()).append("\"");
            } else if (filter.getValueBoolean() != null) {
                stringBuilder.append("valueBoolean: ").append(filter.getValueBoolean());
            } else if (filter.getValueDate() != null) {
                stringBuilder.append("valueDate: \"").append(filter.getValueDate().toInstant()).append("\"");
            } else if (filter.getValueGeoRange() != null) {
                stringBuilder.append(geoRangeToGraphQL(filter.getValueGeoRange()));
            }
            return stringBuilder.toString();
        }

        // Compound filter (And/Or)
        if (filter.getOperator() != null) {
            stringBuilder.append("operator: ").append(filter.getOperator()).append(" ");
        }

        stringBuilder.append("operands: [");

        List<WhereFilter> testOperands = List.of(filter.getOperands());
        // Iterar sobre los operandos
        for (WhereFilter operand : filter.getOperands()) {
            stringBuilder.append("{ ")
                    .append("path: [").append("\"").append(operand.getPath()[0]).append("\"").append("],")
                    //.append("path: [").append("\\\"").append(operand.getPath()[0]).append("\\\"").append("],")
                    .append("operator: ").append(operand.getOperator()).append(", ");

            // Determina el tipo de valor y lo agrega a la cadena
            if (operand.getValueText() != null) {
                stringBuilder.append("valueText: ");
                stringBuilder.append("\"").append(operand.getValueText()).append("\"");
            } else if (operand.getValueBoolean() != null) {
                stringBuilder.append("valueBoolean: ");
                stringBuilder.append(operand.getValueBoolean());
            } else if (operand.getValueDate() != null) {
                stringBuilder.append("valueDate: ");
                //stringBuilder.append("\\\"").append(operand.getValueDate().toInstant().toString()).append("\\\"");
                stringBuilder.append("\"").append(operand.getValueDate().toInstant().toString()).append("\"");
            } else if (operand.getValueGeoRange() != null) {
                stringBuilder.append(geoRangeToGraphQL(operand.getValueGeoRange()));
            }
            stringBuilder.append(" }, ");
        }

        // Elimina la última coma y espacio
        if (stringBuilder.length() > 2) {
            stringBuilder.setLength(stringBuilder.length() - 2);
        }

        stringBuilder.append("]");

        return stringBuilder.toString();
    }

    /***
     *      Convierte la distancia coseno de Weaviate ({@code distance ∈ [0,2]}) a la certeza coseno
     *      ({@code certainty ∈ [0,1]}) que espera el resto del scoring. Es la MISMA relación que usa
     *      Weaviate internamente para coseno ({@code certainty = 1 - distance/2}); ninguna información
     *      se pierde. Se usa porque el campo {@code certainty} rompe sobre named vectors en 1.24.1.
     * ***/
    static double cosineCertaintyFromDistance(double distance) {
        return 1.0 - distance / 2.0;
    }

    /***
     *      Serializa un filtro geográfico WithinGeoRange al formato GraphQL crudo. EU-320: el radio pasa a
     *      aplicarse NATIVAMENTE en Weaviate (antes estaba deshabilitado y "aguas arriba"). "max" es la
     *      distancia máxima en METROS. Verificado contra Weaviate 1.24.1 (nearVector named-vector + este
     *      filtro compuesto): poda por radio correctamente.
     * ***/
    private static String geoRangeToGraphQL(WhereFilter.GeoRange geoRange) {
        return "valueGeoRange: { geoCoordinates: {"
                + " latitude: " + geoRange.getGeoCoordinates().getLatitude()
                + " longitude: " + geoRange.getGeoCoordinates().getLongitude()
                + " } distance: { max: " + geoRange.getDistance().getMax() + " } }";
    }

    /***
     *  Implementa la lógica para convertir un objeto "Map" en un objeto "WeaviateObject".
     ***/
    private WeaviateObject convertToWeaviateObject(Map<String, Object> objectData) {
        WeaviateObject weaviateObject = WeaviateObject.builder().build();
        // "objectData" es un map. La primera key es otro map "_additional" que contiene el id y el score ("certainty").
        weaviateObject.setId((String) (  (Map<String,Object>)objectData.get("_additional")).remove("id")  );

        // Removemos la kay "_additional" para que las keys restantes sean solo "properties" (o sea, atributos del objeto)
        Map<String,Object> additional = (Map<String,Object>)objectData.remove("_additional");
        // EU-320: sobre named vectors pedimos "distance" (el campo "certainty" rompe la query en 1.24.1).
        //  Reconstruimos la certeza coseno que el resto del código espera: certainty = 1 - distance/2
        //  (distance∈[0,2] → certainty∈[0,1]). Es la MISMA definición que usa Weaviate para coseno, así que
        //  el scoring aguas arriba (normalizeCosineScore, MIN_SCORE) queda idéntico. Sólo cuando vino distance
        //  (camino nearVector); el camino hybrid trae "score" y no se toca.
        if (additional != null && additional.get("distance") != null && additional.get("certainty") == null) {
            double distance = ((Number) additional.get("distance")).doubleValue();
            additional.put("certainty", cosineCertaintyFromDistance(distance));
        }
        weaviateObject.setAdditional( additional );

        // Llegado este punto, las únicas keys que contiene "objectData" corresponden a atributos del objeto.
        weaviateObject.setProperties(objectData);

        return weaviateObject;
    }

}
