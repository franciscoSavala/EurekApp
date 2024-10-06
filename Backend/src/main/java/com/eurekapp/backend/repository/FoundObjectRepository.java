package com.eurekapp.backend.repository;


import com.eurekapp.backend.model.FoundObject;
import com.eurekapp.backend.model.GeoCoordinates;
import com.eurekapp.backend.service.CommonFunctions;
import com.eurekapp.backend.service.client.WeaviateService;
import com.eurekapp.backend.service.CommonFunctions.*;

import io.weaviate.client.v1.data.model.WeaviateObject;
import io.weaviate.client.v1.filters.WhereFilter;
import io.weaviate.client.v1.filters.Operator;

import org.springframework.stereotype.Component;

import java.time.*;
import java.util.*;

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
                        "coordinates", Map.of(
                                "latitude", foundObject.getCoordinates().getLatitude(),
                                "longitude", foundObject.getCoordinates().getLongitude()
                        )
                ))
                .vector(foundObject.getEmbeddings().toArray(new Float[0]))
                .build();
        weaviateService.createObject(object);
    }

    public List<FoundObject> query(List<Float> vector,
                                   String orgId,
                                   LocalDateTime foundDate,
                                   boolean wasReturned){

        // Lista de filtros
        List<WhereFilter> filters = new ArrayList<>();

        /* No agregamos el vector al filtro, porque el vector NO VA dentro del WhereFilter.
            Si el vector es null, WeaviateService decidirá cómo lidiar con eso. */

        // TODO: agregar filtro geográfico para un cierto radio NO ELEGIBLE por el usuario. (será regla de negocio)

        // Agregar filtro opcional para organization_id
        if (orgId != null) {
            filters.add(WhereFilter.builder()
                    .path("organization_id")
                    .operator(Operator.Equal)
                    .valueText(orgId)
                    .build());
        }

        // Agregar filtro opcional para foundDate
        if (foundDate != null) {
            ZonedDateTime zonedDateTime = foundDate.atZone(ZoneId.of("GMT"));
            Date castedLostDate = Date.from(zonedDateTime.toInstant());

            filters.add(WhereFilter.builder()
                    .path("found_date")
                    .operator(Operator.GreaterThanEqual)
                    .valueDate(castedLostDate)
                    .build());
        }

        // Agregar filtro para was_returned
        filters.add(WhereFilter.builder()
                .path("was_returned")
                .operator(Operator.Equal)
                .valueBoolean(wasReturned)
                .build());

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

    public FoundObject getByUuid(String uuid){
        WeaviateObject result = weaviateService.getObjectByUuid("FoundObject", uuid);
        if(result == null){return null;}
        return convertToFoundObject(result);
    }

    public void markAsReturned(String uuid){
        Map<String,Object> properties = Map.of("was_returned", true);
        weaviateService.update("FoundObject", uuid, null, properties);
    }

    private FoundObject convertToFoundObject(WeaviateObject weaviateObject) {
        Map<String, Object> properties = weaviateObject.getProperties(); // Asegúrate de que esta función obtenga las propiedades correctamente.

        Float certainty = null;
        if(weaviateObject.getAdditional() != null && weaviateObject.getAdditional().get("certainty") != null) {
            certainty = ((Double) weaviateObject.getAdditional().get("certainty")).floatValue();
        }

        GeoCoordinates location = null;
        if( properties.get("coordinates") != null ){
            location = CommonFunctions.convertToGeoCoordinates((Map<String, Object>) properties.get("coordinates"));
        }

        FoundObject foundObject = FoundObject.builder()
                .uuid(weaviateObject.getId())
                .title((String) properties.get("title"))
                .humanDescription((String) properties.get("human_description"))
                .aiDescription((String) properties.get("ai_description"))
                .foundDate(CommonFunctions.convertToLocalDateTime((String) properties.get("found_date")))
                .wasReturned((Boolean) properties.get("was_returned"))
                .coordinates(location)
                .organizationId((String) properties.get("organization_id"))
                .score(certainty)
                .build();

       return foundObject;
    }

    private LocalDateTime convertToLocalDateTime(String dateString) {
        if (dateString != null) {
            OffsetDateTime offsetDateTime = OffsetDateTime.parse(dateString);
            return offsetDateTime.atZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        }
        return null; // O lanza una excepción, dependiendo de cómo quieras manejar los valores nulos.
    }

    private GeoCoordinates convertToGeoCoordinates(Map<String, Object> locationData) {
        if (locationData != null) {
            double latitude = (Double) locationData.get("latitude");
            double longitude = (Double) locationData.get("longitude");
            return GeoCoordinates.builder()
                    .latitude(latitude)
                    .longitude(longitude)
                    .build();
        }
        return null;
    }
}

