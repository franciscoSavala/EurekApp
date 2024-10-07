package com.eurekapp.backend.repository;


import com.eurekapp.backend.model.GeoCoordinates;
import com.eurekapp.backend.model.LostObject;
import com.eurekapp.backend.service.CommonFunctions;
import com.eurekapp.backend.service.client.WeaviateService;
import com.eurekapp.backend.service.CommonFunctions.*;

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
public class LostObjectRepository {

    private final WeaviateService weaviateService;

    public LostObjectRepository(
            WeaviateService weaviateService){
        this.weaviateService = weaviateService;
    }


    public void add(LostObject lostObject) {
        // TODO: Preguntar a Fran por qué el command viene sin lost_date
        // TODO: Definir properties antes de declarar a "object" para manejar casos en los que orgId = null, y similares.
        WeaviateObject object = WeaviateObject.builder()
                .id(lostObject.getUuid())
                .className("LostObject")
                .properties(Map.of(
                        "username", lostObject.getUsername(),
                        "lost_date", lostObject.getLostDate().toString()+":00Z",
                        "description", lostObject.getDescription(),
                        //"organization_id", lostObject.getOrganizationId(),
                        "coordinates", Map.of(
                                "latitude", lostObject.getCoordinates().getLatitude(),
                                "longitude", lostObject.getCoordinates().getLongitude())
                ))
                .vector(lostObject.getEmbeddings().toArray(new Float[0]))
                .build();

        weaviateService.createObject(object);
    }

    public List<LostObject> query(List<Float> vector,
                                   String username,
                                   String orgId,
                                   LocalDateTime lostDate){

        // Lista de filtros
        List<WhereFilter> filters = new ArrayList<>();

        /* No agregamos el vector al filtro, porque el vector NO VA dentro del WhereFilter.
            Si el vector es null, WeaviateService decidirá cómo lidiar con eso. */

        // Agregar filtro opcional para username
        if (orgId != null) {
            filters.add(WhereFilter.builder()
                    .path("username")
                    .operator(Operator.Equal)
                    .valueText(orgId)
                    .build());
        }

        // Agregar filtro opcional para organization_id
        if (orgId != null) {
            filters.add(WhereFilter.builder()
                    .path("organization_id")
                    .operator(Operator.Equal)
                    .valueText(orgId)
                    .build());
        }

        // TODO: agregar filtro geográfico para un cierto radio NO ELEGIBLE por el usuario. (será regla de negocio)

        // Construir el filtro compuesto (And), si es que efectivamente hay filtros.
        WhereFilter filter = null;
        if(!filters.isEmpty()) {
        filter = WhereFilter.builder()
                .operator(Operator.And)
                .operands(filters.toArray(new WhereFilter[0])) // Convierte la lista en array
                .build();
        }

        List<WeaviateObject> result = weaviateService.queryObjects("LostObject",
                vector,
                filter,
                List.of("username",
                        "description",
                        "lost_date",
                        "organization_id",
                        "coordinates")
        );

        // Convertir List<WeaviateObject> a List<FoundObject>
        List<LostObject> lostObjects = new ArrayList<>();
        for (WeaviateObject weaviateObject : result) {
            LostObject lostObject = convertToLostObject(weaviateObject);
            lostObjects.add(lostObject);
        }

        return lostObjects;
    }

    private LostObject convertToLostObject(WeaviateObject weaviateObject) {
        Map<String, Object> properties = weaviateObject.getProperties(); // Asegúrate de que esta función obtenga las propiedades correctamente.

        Float certainty = null;
        if(weaviateObject.getAdditional().get("certainty") != null) {
            certainty = ((Double) weaviateObject.getAdditional().get("certainty")).floatValue();
        }

        GeoCoordinates location = null;
        if( properties.get("coordinates") != null ){
            location = CommonFunctions.convertToGeoCoordinates((Map<String, Object>) properties.get("coordinates"));
        }

        LostObject lostObject = LostObject.builder()
                .uuid(weaviateObject.getId())
                .description((String) properties.get("description"))
                .lostDate(CommonFunctions.convertToLocalDateTime((String) properties.get("lost_date")))
                .coordinates(location)
                .organizationId((String) properties.get("organization_id"))
                .score(certainty)
                .build();

        return lostObject;
    }

}