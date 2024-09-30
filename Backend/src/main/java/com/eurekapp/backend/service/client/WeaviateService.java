package com.eurekapp.backend.service.client;


import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.weaviate.client.v1.graphql.model.GraphQLQuery;
import io.weaviate.client.v1.graphql.model.GraphQLResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;


import io.weaviate.client.WeaviateClient;
import io.weaviate.client.v1.data.model.WeaviateObject;
import io.weaviate.client.base.Result;
import io.weaviate.client.v1.filters.WhereFilter;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;


@Service
public class WeaviateService {

    private static final Logger log = LoggerFactory.getLogger(WeaviateService.class);

    private final WeaviateClient weaviateClient;

    private final String urlSchema = "/schema";
    private final String urlInsert = "/objects";
    private final String urlQuery = "/graphql";

    public WeaviateService(
            @Qualifier("weaviateClient") WeaviateClient weaviateClient
    ) {
        this.weaviateClient = weaviateClient;
    }

    public void createObject(WeaviateObject object) {
        Result<WeaviateObject> result = weaviateClient.data().creator()
                .withClassName(object.getClassName())
                .withID(object.getId())
                .withProperties(object.getProperties())
                .withVector(object.getVector())
                .run();
        if (result.hasErrors()) {
            System.out.println(result.getError());
        }
        //System.out.println(result.getResult());
    }

    public List<WeaviateObject> queryObjects(String className,
                                                     List<Float> vector,
                                                     WhereFilter filter,
                                                    List<String> fieldNames) {
        //Crearemos el string de la consulta GraphQL

        // 1- Nombre de la clase
        StringBuilder queryBuilder = new StringBuilder();

        queryBuilder.append("{ Get ");
        //queryBuilder.append("{ \"query\": \"{ Get ");
        queryBuilder.append("{ ")
                .append(className).append(" ( ");

        // 2- Agregar el filtro where, si se proporciona
        if (filter != null) {
            queryBuilder.append("where: { ")
                    .append(WeaviateService.toGraphQLString(filter))
                    .append("} ");}

        // 3- Agregar el vector, si se proporciona
        if (vector != null && !vector.isEmpty()) {
            queryBuilder.append("nearVector: { vector: ").append(vector.toString())
                    .append(", certainty: 0.0} ");}
        queryBuilder.append(")");

        // 4- Lista de atributos a incluir en la respuesta
        queryBuilder.append("{ ");
        for (String fieldName : fieldNames) {
            queryBuilder.append(fieldName).append(" ");
            if (fieldName.equals("coordinates")) {
            queryBuilder.append("{ latitude longitude }");}
        }

        queryBuilder.append("_additional { certainty } ");
        queryBuilder.append("}");

        // 5- Cerrar la query
        queryBuilder.append("}}");
        //queryBuilder.append("}}\" }");

        log.info(queryBuilder.toString());


        // Ejecutar la consulta GraphQL
        Result<GraphQLResponse> response = weaviateClient.graphQL().raw().withQuery(queryBuilder.toString()).run();
        log.info(response.toString());
        /// Verificar si hay errores en la respuesta
        if (response.hasErrors()) {
            throw new RuntimeException("Error en la consulta GraphQL: " + response.getError());
        }

        // Crear la lista de WeaviateObject a partir de la respuesta
        List<WeaviateObject> weaviateObjects = new ArrayList<>();
        // Extraer datos de la respuesta
        GraphQLResponse graphQLResponse = response.getResult();
        // Asegurarse de que los datos sean un Map
        if (graphQLResponse.getData() instanceof Map<?, ?>) {
            Map<String, Object> dataMap = (Map<String, Object>) graphQLResponse.getData(); // Hacer cast seguro
            // Verificar y extraer los objetos de la clase correspondiente
            if (dataMap.containsKey(className)) {
                List<Map<String, Object>> objectsData = (List<Map<String, Object>>) dataMap.get(className);
                for (Map<String, Object> objectData : objectsData) {
                    WeaviateObject weaviateObject = convertToWeaviateObject(objectData);
                    weaviateObjects.add(weaviateObject);
                }
            }
        } else {
            throw new RuntimeException("El formato de los datos en la respuesta no es válido.");
        }


        return weaviateObjects;
    }

    private static String toGraphQLString(WhereFilter filter) {
        StringBuilder stringBuilder = new StringBuilder();

        // Asegúrate de que la estructura de WhereFilter tiene los métodos necesarios
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
            }
            // Agrega otros tipos de valores según sea necesario

            stringBuilder.append(" }, ");
        }

        // Elimina la última coma y espacio
        if (stringBuilder.length() > 2) {
            stringBuilder.setLength(stringBuilder.length() - 2);
        }

        stringBuilder.append("]");

        return stringBuilder.toString();
    }

    private WeaviateObject convertToWeaviateObject(Map<String, Object> objectData) {
        // Implementa la lógica para convertir el mapa de datos en un objeto WeaviateObject
        WeaviateObject weaviateObject = WeaviateObject.builder().build();
        // Establece las propiedades de WeaviateObject basándote en objectData
        // Por ejemplo:
        // weaviateObject.setId((String) objectData.get("id"));
        // Otros mapeos según las propiedades de WeaviateObject
        return weaviateObject;
    }

}
