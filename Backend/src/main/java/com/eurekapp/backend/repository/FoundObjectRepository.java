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

        // Lista de filtros
        List<WhereFilter> filters = new ArrayList<>();

        /*
        *   No agregamos el vector al filtro, porque el vector NO VA dentro del WhereFilter, sino que es pasado
        *  de forma directa a Weaviate.
        *  WeaviateService decidirá qué hacer si el vector recibido es null.
        * */

        // Agregamos un filtro opcional para las coordenadas.
        if(coordinates != null){
            /*
             * Definimos el radio al cual vamos a circunscribir la búsqueda.
            *  Esta definición es una regla de negocio.
            *  Esta distancia será igual a 50 km. Está expresada en metros.
            * */
            Float maxDistance = (maxRadius).floatValue();

            //El siguiente código está comentado temporalmente, hasta que solucionemos el bug de Weaviate con "WithinGeoRange".
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

        // Agregamos un filtro opcional para la organización.
        if (orgId != null) {
            filters.add(WhereFilter.builder()
                    .path("organization_id")
                    .operator(Operator.Equal)
                    .valueText(orgId)
                    .build());
        }

        // Agregamos un filtro opcional para foundDate.
        if (foundDate != null) {
            ZonedDateTime zonedDateTime = foundDate.atZone(ZoneId.of("GMT"));
            Date castedLostDate = Date.from(zonedDateTime.toInstant());

            filters.add(WhereFilter.builder()
                    .path("found_date")
                    .operator(Operator.GreaterThanEqual)
                    .valueDate(castedLostDate)
                    .build());
        }

        // Agregamos un filtro opcional para foundDateTo (upper bound).
        if (foundDateTo != null) {
            ZonedDateTime zonedDateTimeTo = foundDateTo.atZone(ZoneId.of("GMT"));
            Date castedFoundDateTo = Date.from(zonedDateTimeTo.toInstant());

            filters.add(WhereFilter.builder()
                    .path("found_date")
                    .operator(Operator.LessThan)
                    .valueDate(castedFoundDateTo)
                    .build());
        }

        // Agregamos el filtro para was_returned.
        if (wasReturned != null) {
            filters.add(WhereFilter.builder()
                    .path("was_returned")
                    .operator(Operator.Equal)
                    .valueBoolean(wasReturned)
                    .build());
        }

        // Agregamos un filtro opcional para la categoría.
        if (category != null) {
            filters.add(WhereFilter.builder()
                    .path("category")
                    .operator(Operator.Equal)
                    .valueText(category)
                    .build());
        }

        // Construimos el filtro compuesto (And).
        WhereFilter filter = null;
        if (filters.size() == 1) {
            filter = filters.get(0);
        } else if (filters.size() > 1) {
            filter = WhereFilter.builder()
                    .operator(Operator.And)
                    .operands(filters.toArray(new WhereFilter[0]))
                    .build();
        }

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

