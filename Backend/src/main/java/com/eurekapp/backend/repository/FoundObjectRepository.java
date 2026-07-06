package com.eurekapp.backend.repository;


import com.eurekapp.backend.model.FoundObject;
import com.eurekapp.backend.model.GeoCoordinates;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.service.CommonFunctions;
import com.eurekapp.backend.service.client.WeaviateService;

import io.weaviate.client.v1.data.model.WeaviateObject;
import io.weaviate.client.v1.filters.WhereFilter;
import io.weaviate.client.v1.filters.Operator;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Component
public class FoundObjectRepository {

    // Radio al que se circunscribirán las búsquedas, expresado en metros.
    private static final Double maxRadius = 50000.0;
    private static final Logger log = LoggerFactory.getLogger(FoundObjectRepository.class);
    private final WeaviateService weaviateService;
    private final IUserRepository userRepository;

    public FoundObjectRepository(
            WeaviateService weaviateService, IUserRepository userRepository){
        this.weaviateService = weaviateService;
        this.userRepository = userRepository;
    }

    public void add(FoundObject foundObject){
        // Definir el objeto que se cargará
        WeaviateObject object = WeaviateObject.builder()
                .id(foundObject.getUuid())
                .className("FoundObject")
                .properties(new java.util.HashMap<>(Map.of(
                        "found_date", foundObject.getFoundDate().atOffset(ZoneOffset.UTC).format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'")),
                            "title", foundObject.getTitle(),
                        "object_finder_user_id", foundObject.getObjectFinderUser() != null? foundObject.getObjectFinderUser().getId().toString():"0",
                        "human_description", foundObject.getHumanDescription(),
                        "organization_id", foundObject.getOrganizationId(),
                        "was_returned", foundObject.getWasReturned(),
                        "category", foundObject.getCategory() != null ? foundObject.getCategory() : "",
                        "coordinates", Map.of(
                                "latitude", foundObject.getCoordinates().getLatitude(),
                                "longitude", foundObject.getCoordinates().getLongitude()
                        )
                )))
                // EU-323: dos vectores nombrados (image/text). Persistimos sólo los que estén presentes.
                .vectors(namedVectors(foundObject.getImageEmbedding(), foundObject.getTextEmbedding()))
                .build();
        log.info("Uploading FoundObject with named vectors: {}", object.getId());
        weaviateService.createObject(object);
    }

    /**
     * EU-323: arma el mapa de vectores nombrados (image/text) para Weaviate, incluyendo sólo los que
     * no son nulos ni vacíos. Un objeto puede tener sólo uno (p. ej. una búsqueda sin foto).
     */
    static Map<String, Float[]> namedVectors(List<Float> imageEmbedding, List<Float> textEmbedding) {
        Map<String, Float[]> vectors = new java.util.HashMap<>();
        if (imageEmbedding != null && !imageEmbedding.isEmpty()) {
            vectors.put("image", imageEmbedding.toArray(new Float[0]));
        }
        if (textEmbedding != null && !textEmbedding.isEmpty()) {
            vectors.put("text", textEmbedding.toArray(new Float[0]));
        }
        return vectors;
    }

    public List<FoundObject> query(List<Float> vector,
                                   String orgId,
                                   GeoCoordinates coordinates,
                                   LocalDateTime foundDate,
                                   LocalDateTime foundDateTo,
                                   Boolean wasReturned,
                                   String category){
        return query(vector, orgId, coordinates, foundDate, foundDateTo, wasReturned, category, null, null);
    }

    public List<FoundObject> query(List<Float> vector,
                                   String orgId,
                                   GeoCoordinates coordinates,
                                   LocalDateTime foundDate,
                                   LocalDateTime foundDateTo,
                                   Boolean wasReturned,
                                   String category,
                                   Integer limit,
                                   Integer offset){

        WhereFilter filter = buildFilter(orgId, coordinates, foundDate, foundDateTo, wasReturned, category);

        // EU-323: la búsqueda textual (única por ahora) va contra el vector nombrado "text".
        List<WeaviateObject> result = weaviateService.queryObjects("FoundObject",
                vector,
                "text",
                filter,
                List.of("title",
                        "object_finder_user_id",
                        "human_description",
                        "found_date",
                        "was_returned",
                        "coordinates",
                        "organization_id",
                        "category"),
                limit,
                offset
        );

        // Convertir List<WeaviateObject> a List<FoundObject>
        List<FoundObject> foundObjects = new ArrayList<>();
        for (WeaviateObject weaviateObject : result) {
            FoundObject foundObject = convertToFoundObject(weaviateObject);
            foundObjects.add(foundObject);
        }

        return foundObjects;
    }

    /**
     * EU-324: construye el filtro compuesto (And) de la búsqueda a partir de los filtros opcionales.
     * Extraído para poder reutilizarlo entre la query textual legacy y {@link #queryDual}.
     * Devuelve {@code null} si no hay ningún filtro.
     */
    private WhereFilter buildFilter(String orgId,
                                    GeoCoordinates coordinates,
                                    LocalDateTime foundDate,
                                    LocalDateTime foundDateTo,
                                    Boolean wasReturned,
                                    String category) {
        List<WhereFilter> filters = new ArrayList<>();

        // El filtro geográfico (WithinGeoRange) está deshabilitado por un bug de Weaviate; el radio
        // se aplica aguas arriba. Dejamos el parámetro para no cambiar el contrato de la búsqueda.
        if (coordinates != null) {
            Float maxDistance = (maxRadius).floatValue();
            /*filters.add(WhereFilter.builder()
                    .path("coordinates")
                    .operator(Operator.WithinGeoRange)
                    .valueGeoRange(WhereFilter.GeoRange.builder()
                            .geoCoordinates(WhereFilter.GeoCoordinates.builder()
                                            .latitude(coordinates.getLatitude().floatValue())
                                            .longitude(coordinates.getLongitude().floatValue())
                                            .build())
                            .distance(WhereFilter.GeoDistance.builder().max(maxDistance).build())
                            .build())
                    .build());*/
        }

        if (orgId != null) {
            filters.add(WhereFilter.builder()
                    .path("organization_id")
                    .operator(Operator.Equal)
                    .valueText(orgId)
                    .build());
        }

        if (foundDate != null) {
            ZonedDateTime zonedDateTime = foundDate.atZone(ZoneId.of("GMT"));
            Date castedLostDate = Date.from(zonedDateTime.toInstant());
            filters.add(WhereFilter.builder()
                    .path("found_date")
                    .operator(Operator.GreaterThanEqual)
                    .valueDate(castedLostDate)
                    .build());
        }

        if (foundDateTo != null) {
            ZonedDateTime zonedDateTimeTo = foundDateTo.atZone(ZoneId.of("GMT"));
            Date castedFoundDateTo = Date.from(zonedDateTimeTo.toInstant());
            filters.add(WhereFilter.builder()
                    .path("found_date")
                    .operator(Operator.LessThan)
                    .valueDate(castedFoundDateTo)
                    .build());
        }

        if (wasReturned != null) {
            filters.add(WhereFilter.builder()
                    .path("was_returned")
                    .operator(Operator.Equal)
                    .valueBoolean(wasReturned)
                    .build());
        }

        if (category != null) {
            filters.add(WhereFilter.builder()
                    .path("category")
                    .operator(Operator.Equal)
                    .valueText(category)
                    .build());
        }

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
     * EU-324: búsqueda combinada imagen + texto. Corre dos consultas vectoriales contra los vectores
     * nombrados "image" y "text" (según cuál vector se reciba) y fusiona los candidatos por UUID,
     * exponiendo en cada uno su certeza coseno por modalidad ({@code imageCertainty}/{@code textCertainty}).
     * Un candidato que sólo aparece por una modalidad queda con la otra certeza en {@code null}.
     *
     * <p>No calcula el puntaje final: eso lo hace {@link com.eurekapp.backend.service.SearchScoringService}
     * aguas arriba (EU-324-D). El {@code score} de cada candidato queda en {@code null}.</p>
     */
    public List<FoundObject> queryDual(List<Float> imageVector,
                                       List<Float> textVector,
                                       String orgId,
                                       GeoCoordinates coordinates,
                                       LocalDateTime foundDate,
                                       LocalDateTime foundDateTo,
                                       Boolean wasReturned,
                                       String category,
                                       Integer limit,
                                       Integer offset) {
        WhereFilter filter = buildFilter(orgId, coordinates, foundDate, foundDateTo, wasReturned, category);
        List<String> fields = List.of("title",
                "object_finder_user_id",
                "human_description",
                "found_date",
                "was_returned",
                "coordinates",
                "organization_id",
                "category");

        // Preservamos el orden de aparición (primero los candidatos por imagen, luego los nuevos por texto).
        Map<String, FoundObject> merged = new LinkedHashMap<>();

        if (imageVector != null && !imageVector.isEmpty()) {
            for (WeaviateObject wo : weaviateService.queryObjects("FoundObject", imageVector, "image",
                    filter, fields, limit, offset)) {
                FoundObject candidate = convertToFoundObject(wo);
                candidate.setImageCertainty(candidate.getScore());
                candidate.setScore(null);
                merged.put(candidate.getUuid(), candidate);
            }
        }

        if (textVector != null && !textVector.isEmpty()) {
            for (WeaviateObject wo : weaviateService.queryObjects("FoundObject", textVector, "text",
                    filter, fields, limit, offset)) {
                FoundObject candidate = convertToFoundObject(wo);
                FoundObject existing = merged.get(candidate.getUuid());
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

        UserEurekapp objectFinderUser= null;
        Object finderIdRaw = properties.get("object_finder_user_id");
        Long objectFinderUserId = finderIdRaw != null ? Long.parseLong(finderIdRaw.toString()) : 0L;
        if( objectFinderUserId != 0){
            objectFinderUser = userRepository.getReferenceById( objectFinderUserId );
        }

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
                .objectFinderUser(objectFinderUser)
                .humanDescription((String) properties.get("human_description"))
                .foundDate(CommonFunctions.convertToLocalDateTime((String) properties.get("found_date")))
                .wasReturned((Boolean) properties.get("was_returned"))
                .coordinates(location)
                .organizationId((String) properties.get("organization_id"))
                .category((String) properties.get("category"))
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

