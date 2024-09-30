package com.eurekapp.backend.repository;


import com.eurekapp.backend.model.FoundObject;
import com.eurekapp.backend.service.client.WeaviateService;

import io.weaviate.client.v1.data.model.WeaviateObject;
import io.weaviate.client.v1.filters.WhereFilter;
import io.weaviate.client.v1.filters.Operator;

import org.springframework.stereotype.Component;

import java.time.*;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;

@Component
public class FoundObjectRepository {

    private final WeaviateService weaviateService;

    public FoundObjectRepository(
            WeaviateService weaviateService){
        this.weaviateService = weaviateService;
    }

    public void add(FoundObject foundObject){
        // Definir el objeto que se cargará
        WeaviateObject object = WeaviateObject.builder()
                .id(foundObject.getUuid())
                .className("FoundObject")
                .properties(Map.of(
                        "found_date", foundObject.getFoundDate().toString()+":00Z",
                            "title", foundObject.getTitle(),
                        "human_description", foundObject.getHumanDescription(),
                        "ai_description", foundObject.getAiDescription(),
                        "organization_id", foundObject.getOrganizationId(),
                        "was_returned", foundObject.getWasReturned(),
                        "coordinates", Map.of(                            // Si coordinates es un campo de tipo geoespacial
                                "latitude", foundObject.getLocation().getLatitude(),                      // Coordenadas reales
                                "longitude", foundObject.getLocation().getLongitude()
                        )
                ))
                .vector(foundObject.getEmbeddings().toArray(new Float[0]))
                .build();
        weaviateService.createObject(object);
    }

    public List<FoundObject> query(List<Float> vector,
                                   String orgId,
                                   LocalDateTime lostDate,
                                   boolean wasReturned){

        // Lista de filtros
        List<WhereFilter> filters = new ArrayList<>();

        // Agregar filtro para was_returned
        filters.add(WhereFilter.builder()
                .path("was_returned")
                .operator(Operator.Equal)
                .valueBoolean(wasReturned)
                .build());

        // Agregar filtro opcional para organization_id
        if (orgId != null) {
            filters.add(WhereFilter.builder()
                    .path("organization_id")
                    .operator(Operator.Equal)
                    .valueText(orgId)
                    .build());
        }

        // Agregar filtro opcional para lostDate
        if (lostDate != null) {
            ZonedDateTime zonedDateTime = lostDate.atZone(ZoneId.of("GMT"));
            Date castedLostDate = Date.from(zonedDateTime.toInstant());

            filters.add(WhereFilter.builder()
                    .path("found_date")
                    .operator(Operator.GreaterThanEqual)
                    .valueDate(castedLostDate)
                    .build());
        }

        // Construir el filtro compuesto (And)
        WhereFilter filter = WhereFilter.builder()
                .operator(Operator.And)
                .operands(filters.toArray(new WhereFilter[0])) // Convierte la lista en array
                .build();

        List<WeaviateObject> result = weaviateService.queryObjects("FoundObject",
                vector,
                filter,
                List.of("title",
                        "human_description",
                        "ai_description",
                        "found_date",
                        "was_returned",
                        "coordinates",
                        "organization_id")
        );

        // Convertir List<WeaviateObject> a List<FoundObject>
        List<FoundObject> foundObjects = new ArrayList<>();
        for (WeaviateObject weaviateObject : result) {
            FoundObject foundObject = convertToFoundObject(weaviateObject);
            foundObjects.add(foundObject);
        }

        return foundObjects;
    }

    private FoundObject convertToFoundObject(WeaviateObject weaviateObject) {
        Map<String, Object> properties = weaviateObject.getProperties(); // Asegúrate de que esta función obtenga las propiedades correctamente.

        // Extraer los valores necesarios del WeaviateObject
        return FoundObject.builder()
                .uuid(weaviateObject.getId()) // Ajusta si el id es diferente de uuid
                .embeddings((List<Float>) properties.get("embeddings"))
                .foundDate(convertToLocalDateTime((String) properties.get("found_date"))) // Asegúrate de que este campo sea una cadena
                .title((String) properties.get("title"))
                .humanDescription((String) properties.get("human_description"))
                .aiDescription((String) properties.get("ai_description"))
                .organizationId((String) properties.get("organization_id"))
                .location(convertToGeoCoordinates((Map<String, Object>) properties.get("location")))
                .wasReturned((Boolean) properties.get("was_returned"))
                .score((Float) weaviateObject.getAdditional().get("certainty"))
                .build();
    }

    private LocalDateTime convertToLocalDateTime(String dateString) {
        if (dateString != null) {
            OffsetDateTime offsetDateTime = OffsetDateTime.parse(dateString);
            return offsetDateTime.atZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        }
        return null; // O lanza una excepción, dependiendo de cómo quieras manejar los valores nulos.
    }

    private FoundObject.GeoCoordinates convertToGeoCoordinates(Map<String, Object> locationData) {
        if (locationData != null) {
            double latitude = (Double) locationData.get("latitude");
            double longitude = (Double) locationData.get("longitude");
            return FoundObject.GeoCoordinates.builder()
                    .latitude(latitude)
                    .longitude(longitude)
                    .build();
        }
        return null; // O lanza una excepción si el campo location es obligatorio.
    }
}

