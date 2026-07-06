package com.eurekapp.backend.repository;


import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.model.GeoCoordinates;
import com.eurekapp.backend.model.LostObject;
import com.eurekapp.backend.model.LostObjectStatus;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.service.CommonFunctions;
import com.eurekapp.backend.service.client.WeaviateService;
import com.eurekapp.backend.service.CommonFunctions.*;

import io.weaviate.client.v1.data.model.WeaviateObject;
import io.weaviate.client.v1.filters.WhereFilter;
import io.weaviate.client.v1.filters.Operator;

import org.springframework.stereotype.Component;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class LostObjectRepository {

    private final WeaviateService weaviateService;
    private final IOrganizationRepository organizationRepository;

    public LostObjectRepository(
            WeaviateService weaviateService,
            IOrganizationRepository organizationRepository){
        this.weaviateService = weaviateService;
        this.organizationRepository = organizationRepository;
    }


    public void add(LostObject lostObject) {
        // TODO: Preguntar a Fran por qué el command viene sin lost_date
        HashMap<String, Double> coordinatesMap = new HashMap<>();
        if (lostObject.getCoordinates() == null) {
            if (lostObject.getOrganizationId() != null) {
                Organization organization = organizationRepository
                        .findById(Long.valueOf(lostObject.getOrganizationId()))
                        .orElseThrow(() -> new BadRequestException("org_not_found",
                                "Organization not found"));
                if (organization.getCoordinates() != null) {
                    coordinatesMap.put("longitude", organization.getCoordinates().getLongitude());
                    coordinatesMap.put("latitude", organization.getCoordinates().getLatitude());
                } else {
                    coordinatesMap.put("longitude", -64.1867);
                    coordinatesMap.put("latitude", -31.4124);
                }
            } else {
                coordinatesMap.put("longitude", -64.1867);
                coordinatesMap.put("latitude", -31.4124);
            }
        } else {
            coordinatesMap.put("longitude", lostObject.getCoordinates().getLongitude());
            coordinatesMap.put("latitude", lostObject.getCoordinates().getLatitude());
        }

        HashMap<String, Object> properties = new HashMap<>();
        properties.put("username", lostObject.getUsername());
        String lostDateStr = lostObject.getLostDate() != null
                ? lostObject.getLostDate().toInstant(ZoneOffset.UTC).toString()
                : LocalDateTime.now().toInstant(ZoneOffset.UTC).toString();
        properties.put("lost_date", lostDateStr);
        properties.put("description", lostObject.getDescription());
        properties.put("organization_id", lostObject.getOrganizationId());
        properties.put("coordinates", coordinatesMap);
        // EU-292: toda búsqueda nace ACTIVE. El cierre es lógico (ver close()).
        LostObjectStatus status = lostObject.getStatus() != null ? lostObject.getStatus() : LostObjectStatus.ACTIVE;
        properties.put("status", status.name());
        // EU-323: categoría dura (definida por IA desde la imagen). Vacío si aún no se clasificó.
        properties.put("category", lostObject.getCategory() != null ? lostObject.getCategory() : "");

        WeaviateObject object = WeaviateObject.builder()
                .id(lostObject.getUuid())
                .className("LostObject")
                .properties(properties)
                // EU-323: dos vectores nombrados (image/text). Persistimos sólo los presentes.
                .vectors(FoundObjectRepository.namedVectors(lostObject.getImageEmbedding(), lostObject.getTextEmbedding()))
                .build();

        weaviateService.createObject(object);
    }

    public List<LostObject> query(List<Float> vector,
                                   String username,
                                   String orgId,
                                   LocalDateTime lostDateFrom,
                                   LocalDateTime lostDateTo){
        return query(vector, username, orgId, lostDateFrom, lostDateTo, null, null);
    }

    public List<LostObject> query(List<Float> vector,
                                   String username,
                                   String orgId,
                                   LocalDateTime lostDateFrom,
                                   LocalDateTime lostDateTo,
                                   Integer limit,
                                   Integer offset){

        WhereFilter filter = buildFilter(username, orgId, lostDateFrom, lostDateTo);

        // EU-323: la búsqueda inversa (found→lost) es textual y va contra el vector nombrado "text".
        List<WeaviateObject> result = weaviateService.queryObjects("LostObject",
                vector,
                "text",
                filter,
                List.of("username",
                        "description",
                        "lost_date",
                        "organization_id",
                        "coordinates",
                        "status",
                        "closed_date",
                        "recovered",
                        "category"),
                limit,
                offset
        );

        // Convertir List<WeaviateObject> a List<FoundObject>
        List<LostObject> lostObjects = new ArrayList<>();
        for (WeaviateObject weaviateObject : result) {
            LostObject lostObject = convertToLostObject(weaviateObject);
            lostObjects.add(lostObject);
        }

        return lostObjects;
    }

    /**
     * EU-324: construye el filtro compuesto (And) a partir de los filtros opcionales de la búsqueda
     * inversa. Extraído para reutilizarlo entre la query textual legacy y {@link #queryDual}.
     * Devuelve {@code null} si no hay ningún filtro.
     */
    private WhereFilter buildFilter(String username,
                                    String orgId,
                                    LocalDateTime lostDateFrom,
                                    LocalDateTime lostDateTo) {
        List<WhereFilter> filters = new ArrayList<>();

        if (username != null) {
            filters.add(WhereFilter.builder()
                    .path("username")
                    .operator(Operator.Equal)
                    .valueText(username)
                    .build());
        }

        if (orgId != null) {
            filters.add(WhereFilter.builder()
                    .path("organization_id")
                    .operator(Operator.Equal)
                    .valueText(orgId)
                    .build());
        }

        if (lostDateFrom != null) {
            ZonedDateTime zonedDateTimeFrom = lostDateFrom.atZone(ZoneId.of("GMT"));
            Date castedLostDateFrom = Date.from(zonedDateTimeFrom.toInstant());
            filters.add(WhereFilter.builder()
                    .path("lost_date")
                    .operator(Operator.GreaterThanEqual)
                    .valueDate(castedLostDateFrom)
                    .build());
        }

        if (lostDateTo != null) {
            ZonedDateTime zonedDateTimeTo = lostDateTo.atZone(ZoneId.of("GMT"));
            Date castedLostDateTo = Date.from(zonedDateTimeTo.toInstant());
            filters.add(WhereFilter.builder()
                    .path("lost_date")
                    .operator(Operator.LessThan)
                    .valueDate(castedLostDateTo)
                    .build());
        }

        // TODO: agregar filtro geográfico para un cierto radio NO ELEGIBLE por el usuario. (será regla de negocio)

        if (filters.size() == 1) {
            return filters.get(0);
        } else if (filters.size() > 1) {
            return WhereFilter.builder()
                    .operator(Operator.And)
                    .operands(filters.toArray(new WhereFilter[0]))
                    .build();
        }
        return null;
    }

    /**
     * EU-324: búsqueda inversa combinada imagen + texto. Corre dos consultas contra los vectores
     * nombrados "image" y "text" (según cuál vector se reciba) y fusiona los candidatos por UUID,
     * exponiendo en cada uno su certeza coseno por modalidad ({@code imageCertainty}/{@code textCertainty}).
     * Un candidato que sólo aparece por una modalidad queda con la otra certeza en {@code null}.
     *
     * <p>No calcula el puntaje final (lo hace {@code SearchScoringService} aguas arriba, EU-324-D);
     * el {@code score} de cada candidato queda en {@code null}.</p>
     */
    public List<LostObject> queryDual(List<Float> imageVector,
                                      List<Float> textVector,
                                      String username,
                                      String orgId,
                                      LocalDateTime lostDateFrom,
                                      LocalDateTime lostDateTo,
                                      Integer limit,
                                      Integer offset) {
        WhereFilter filter = buildFilter(username, orgId, lostDateFrom, lostDateTo);
        List<String> fields = List.of("username",
                "description",
                "lost_date",
                "organization_id",
                "coordinates",
                "status",
                "closed_date",
                "recovered",
                "category");

        // Preservamos el orden de aparición (primero los candidatos por imagen, luego los nuevos por texto).
        Map<String, LostObject> merged = new LinkedHashMap<>();

        if (imageVector != null && !imageVector.isEmpty()) {
            for (WeaviateObject wo : weaviateService.queryObjects("LostObject", imageVector, "image",
                    filter, fields, limit, offset)) {
                LostObject candidate = convertToLostObject(wo);
                candidate.setImageCertainty(candidate.getScore());
                candidate.setScore(null);
                merged.put(candidate.getUuid(), candidate);
            }
        }

        if (textVector != null && !textVector.isEmpty()) {
            for (WeaviateObject wo : weaviateService.queryObjects("LostObject", textVector, "text",
                    filter, fields, limit, offset)) {
                LostObject candidate = convertToLostObject(wo);
                LostObject existing = merged.get(candidate.getUuid());
                if (existing != null) {
                    existing.setTextCertainty(candidate.getScore());
                } else {
                    candidate.setTextCertainty(candidate.getScore());
                    candidate.setScore(null);
                    merged.put(candidate.getUuid(), candidate);
                }
            }
        }

        return new ArrayList<>(merged.values());
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

        // EU-292: las búsquedas previas a la migración no traen "status"; se asumen ACTIVE.
        String statusStr = (String) properties.get("status");
        LostObjectStatus status = statusStr != null ? LostObjectStatus.valueOf(statusStr) : LostObjectStatus.ACTIVE;
        String closedDateStr = (String) properties.get("closed_date");
        LocalDateTime closedDate = closedDateStr != null && !closedDateStr.isBlank()
                ? CommonFunctions.convertToLocalDateTime(closedDateStr) : null;

        LostObject lostObject = LostObject.builder()
                .uuid(weaviateObject.getId())
                .username((String) properties.get("username"))
                .description((String) properties.get("description"))
                .lostDate(CommonFunctions.convertToLocalDateTime((String) properties.get("lost_date")))
                .coordinates(location)
                .organizationId((String) properties.get("organization_id"))
                .category((String) properties.get("category"))
                .score(certainty)
                .status(status)
                .closedDate(closedDate)
                .recovered((Boolean) properties.get("recovered"))
                .build();

        return lostObject;
    }

    /**
     * EU-292: trae una búsqueda guardada por su UUID (sin vector, vía getter directo de Weaviate).
     * Devuelve {@code null} si no existe.
     */
    public LostObject getByUuid(String uuid) {
        WeaviateObject object = weaviateService.getObjectByUuid("LostObject", uuid);
        if (object == null) {
            return null;
        }
        Map<String, Object> properties = object.getProperties() != null ? object.getProperties() : new HashMap<>();

        GeoCoordinates location = null;
        if (properties.get("coordinates") != null) {
            location = CommonFunctions.convertToGeoCoordinates((Map<String, Object>) properties.get("coordinates"));
        }
        String statusStr = (String) properties.get("status");
        LostObjectStatus status = statusStr != null ? LostObjectStatus.valueOf(statusStr) : LostObjectStatus.ACTIVE;
        String closedDateStr = (String) properties.get("closed_date");
        LocalDateTime closedDate = closedDateStr != null && !closedDateStr.isBlank()
                ? CommonFunctions.convertToLocalDateTime(closedDateStr) : null;

        return LostObject.builder()
                .uuid(object.getId())
                .username((String) properties.get("username"))
                .description((String) properties.get("description"))
                .lostDate(CommonFunctions.convertToLocalDateTime((String) properties.get("lost_date")))
                .coordinates(location)
                .organizationId((String) properties.get("organization_id"))
                .category((String) properties.get("category"))
                .status(status)
                .closedDate(closedDate)
                .recovered((Boolean) properties.get("recovered"))
                .build();
    }

    /**
     * EU-292: cierre LÓGICO de una búsqueda guardada. No borra el objeto: hace un merge en Weaviate
     * que sólo cambia "status" a CLOSED y registra "closed_date".
     */
    public void close(String uuid, LocalDateTime closedDate, boolean recovered) {
        Map<String, Object> properties = new HashMap<>();
        properties.put("status", LostObjectStatus.CLOSED.name());
        properties.put("closed_date", closedDate.toInstant(ZoneOffset.UTC).toString());
        properties.put("recovered", recovered);
        weaviateService.update("LostObject", uuid, null, properties);
    }

}