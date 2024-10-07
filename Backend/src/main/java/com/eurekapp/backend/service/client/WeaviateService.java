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
        Result<WeaviateObject> result = weaviateClient.data().creator()
                .withClassName(object.getClassName())
                .withID(object.getId())
                .withProperties(object.getProperties())
                .withVector(object.getVector())
                .run();
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
                                                     WhereFilter filter,
                                                    List<String> fieldNames) {
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

        // 5- Sin importar para qué clase estamos haciendo una query vectorial, siempre querremos saber el id y la
        //  certeza de cad resultado.
        queryBuilder.append("_additional { id certainty } ");
        queryBuilder.append("}");

        // 5- Cerrar la query
        queryBuilder.append("}}");

        //log.info(queryBuilder.toString());


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
        // Nos aseguramos de que los datos sean un Map
        if (graphQLResponse.getData() instanceof Map<?, ?>) {
            Map<String, Object> dataMap = (Map<String, Object>) graphQLResponse.getData(); // Hacer cast seguro

            // Obtenemos un map con una única key: el nombre de la clase
            Map<String, Object> objectsMap = (Map<String, Object>) dataMap.get("Get");

            // Elaboramos una lista donde cada componente es un resultado de la query
            List<Map<String,Object>> objectsList = (List<Map<String,Object>>) objectsMap.get(className);
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
     *      Toma un objeto WhereFilter y a partir del mismo genera el string correspondiente para poder hacer la
     *      consulta GraphQL.
     * ***/
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
     *  Implementa la lógica para convertir un objeto "Map" en un objeto "WeaviateObject".
     ***/
    private WeaviateObject convertToWeaviateObject(Map<String, Object> objectData) {
        WeaviateObject weaviateObject = WeaviateObject.builder().build();
        // "objectData" es un map. La primera key es otro map "_additional" que contiene el id y el score ("certainty").
        weaviateObject.setId((String) (  (Map<String,Object>)objectData.get("_additional")).remove("id")  );

        // Removemos la kay "_additional" para que las keys restantes sean solo "properties" (o sea, atributos del objeto)
        weaviateObject.setAdditional( (Map<String,Object>)objectData.remove("_additional") );

        // Llegado este punto, las únicas keys que contiene "objectData" corresponden a atributos del objeto.
        weaviateObject.setProperties(objectData);

        return weaviateObject;
    }

}
