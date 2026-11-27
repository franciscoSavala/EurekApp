package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.FoundObjectDto;
import com.eurekapp.backend.dto.FoundObjectsListDto;
import com.eurekapp.backend.exception.ApiException;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.repository.FoundObjectRepository;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.service.client.EmbeddingService;
import com.eurekapp.backend.service.client.ImageClassificationService;
import com.eurekapp.backend.service.client.ImageEmbeddingService;
import com.eurekapp.backend.service.client.TextClassificationService;
import com.eurekapp.backend.util.TextNormalizer;
import lombok.SneakyThrows;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.Comparator;
import java.util.List;

/** Búsqueda de objetos encontrados que están en custodia de las organizaciones: por texto y por foto + texto. */
@Service
public class FoundObjectSearchService {

    /**
     * EU-324: límite altísimo para la recuperación de candidatos ({@code queryDual}). NO es una poda
     * (eso descartaría buenos candidatos antes de ponderar): es un fusible defensivo que a la escala
     * real del producto nunca se alcanza (el universo ya viene acotado por categoría + org/zona).
     */
    private static final int SEARCH_CANDIDATE_LIMIT = 5000;

    private static final Logger log = LoggerFactory.getLogger(FoundObjectSearchService.class);

    private final EmbeddingService embeddingService;
    private final ImageEmbeddingService imageEmbeddingService;
    private final ImageClassificationService imageClassificationService;
    /** EU-337: clasificador de categoría por TEXTO, que tiene PRECEDENCIA sobre el de la foto. */
    private final TextClassificationService textClassificationService;
    private final IOrganizationRepository organizationRepository;
    private final FoundObjectRepository foundObjectRepository;
    private final SearchScoringService searchScoringService;
    private final FoundObjectDtoMapper dtoMapper;
    private final StoragePeriodService storagePeriodService;
    private final LostDateLimitService lostDateLimitService;

    public FoundObjectSearchService(EmbeddingService embeddingService,
                                    ImageEmbeddingService imageEmbeddingService,
                                    ImageClassificationService imageClassificationService,
                                    TextClassificationService textClassificationService,
                                    IOrganizationRepository organizationRepository,
                                    FoundObjectRepository foundObjectRepository,
                                    SearchScoringService searchScoringService,
                                    FoundObjectDtoMapper dtoMapper,
                                    StoragePeriodService storagePeriodService,
                                    LostDateLimitService lostDateLimitService) {
        this.embeddingService = embeddingService;
        this.imageEmbeddingService = imageEmbeddingService;
        this.imageClassificationService = imageClassificationService;
        this.textClassificationService = textClassificationService;
        this.organizationRepository = organizationRepository;
        this.foundObjectRepository = foundObjectRepository;
        this.searchScoringService = searchScoringService;
        this.dtoMapper = dtoMapper;
        this.storagePeriodService = storagePeriodService;
        this.lostDateLimitService = lostDateLimitService;
    }

    /**
     *  Ese método es llamado cuando el usuario desea buscar su objeto perdido entre los objetos que están en custodia
     *  de las organizaciones. Es la búsqueda SÓLO TEXTO (sin foto) de la pantalla unificada (EU-326).
     *
     *  <p><b>EU-337</b> la emparejó con la búsqueda con foto en las tres cosas que las separaban:
     *  la categoría se deduce del TEXTO (antes no había ninguna y no se podía acotar nada), la
     *  geografía MULTIPLICA en vez de sumar, y el puntaje se filtra con el umbral calibrado de este
     *  modo y se muestra remapeado, para que un mismo porcentaje signifique lo mismo con foto y sin
     *  foto.</p>
     *
     * @param command Objeto que tiene todos los parámetros para que el método haga algo...
     * @return Lista que contiene los objetos encontrados, ordenados por el grado de coincidencia con la búsqueda.
     */
    @SneakyThrows
    public FoundObjectsListDto getFoundObjectByTextDescription(SimilarObjectsCommand command){

        // EU-424: la fecha de pérdida no puede ser futura ni superar el plazo de la organización.
        lostDateLimitService.validateLostDate(command.getOrganizationId(), command.getLostDate());

        /*
        *  En base a la descripción provista por el usuario, generamos un vector que la represente.
        * */
        List<Float> embeddings = (command.getQuery() != null && !command.getQuery().isBlank())
                ? embeddingService.getTextVectorRepresentation(TextNormalizer.normalize(command.getQuery()))
                : null;

        /*
        *   La intención detrás de inicializar la organización y las coordenadas como null es que siempre le hagamos el
        *   mismo pedido a foundObjectRepository, independientemente de si la búsqueda es en una organización o por
        *   coordenadas.
        *
        *   Si el user está haciendo una búsqueda dentro de una organización, el command tendrá valores null para
        *   la latitud y para la longitud, y tendrá un valor válido para el id de la organización.
        *
        *   Si el user está haciendo una búsqueda por coordenadas, el command tendrá un valor null para el id de
        *   organización, y valores válidos de latitud y de longitud.
        * */

        // Validamos que o se haya provisto una organización, o se hayan provisto coordenadas.
        if(command.getOrganizationId() == null && (command.getLatitude() == null || command.getLongitude() == null))
            throw new ApiException("Api error:", "Invalid parameters", HttpStatus.BAD_REQUEST);

        // Inicializamos la organización como null, y si el usuario proveyó una, usaremos el valor que viene en el
        // command.
        String orgId = null;
        if(command.getOrganizationId() != null){ orgId = command.getOrganizationId().toString();}

        /*
        *   Inicializamos las coordenadas como null. Serán usadas para calcular el score geográfico.
        *   -Si el usuario proveyó coordenadas, usaremos la latitud y longitud que vienen en el command.
        *   -Si el usuario proveyó una organización, usaremos la latitud y longitud de la organización.
        */
        GeoCoordinates queryCoordinates = null;
        if(orgId != null && organizationRepository.existsById(command.getOrganizationId()) ){
            queryCoordinates = organizationRepository.findById(command.getOrganizationId())
                .get()
                .getCoordinates();
        }else{
            queryCoordinates = GeoCoordinates.builder()
                    .latitude(command.getLatitude())
                    .longitude(command.getLongitude())
                    .build();
        }


        /* Le pedimos a FoundObjectRepository que nos devuelva los objetos FoundObject similares al vector, con fecha
        *  posterior a la provista, y que no hayan sido devueltos.
        *  Dependiendo de si la búsqueda es por organización o por coordenadas, u "orgId" o "coordinates" valdrán null.
        * */
        /* EU-337: la categoría la deduce la IA del TEXTO de la búsqueda, no la elige el usuario (el
         * selector manual se eliminó en EU-326). Si el texto no nombra el objeto, el clasificador se
         * ABSTIENE y devuelve null: entonces no se filtra por categoría —igual que antes— en vez de
         * inventar una, porque el filtro es duro y una categoría errada esconde el objeto en silencio. */
        ObjectCategory category = textClassificationService.classify(command.getQuery());
        log.debug("getFoundObjectByTextDescription: categoria deducida del texto={}", category);

        // EU-452: los objetos vencidos según el plazo de guarda de su organización no se ofrecen.
        List<FoundObject> foundObjects = storagePeriodService.excludeExpired(foundObjectRepository.query(embeddings,
                                                                    orgId,
                                                                    queryCoordinates,
                                                                    command.getLostDate(),
                                                                    command.getLostDateTo(),
                                                                    false,
                                                                    category != null ? category.name() : null));

        /*
        *  Llegados a este punto, tenemos todos los objetos encontrados que cumplen con las restricciones de espacio
        *  y tiempo, y conocemos la distancia coseno entre cada uno de estos objetos y la búsqueda.
        *  Para obtener el puntaje total en base al cual ordenaremos los resultados, calcularemos un puntaje
        *  geográfico en base a las coordenadas, y lo combinaremos con la distancia coseno usando MOORA.
        */
        for(FoundObject fo: foundObjects){
            /* Mismo puntaje que la búsqueda con foto, con la certeza de imagen ausente: la geografía
             * MULTIPLICA. Antes sumaba un 5%, así que estar cerca compensaba no parecerse. */
            double totalScore = searchScoringService.combinedScore(null, fo.getScore(), category,
                    fo.getCoordinates(), queryCoordinates);
            Double distance = CommonFunctions.calculateGeoDistance(fo.getCoordinates(), queryCoordinates);
            fo.setScore((float) totalScore);
            fo.setDistance(distance.floatValue());
        }

        List<FoundObjectDto> result = filterAndRemapByScore(foundObjects, SearchScoringService.SearchMode.TEXT_ONLY);

        return FoundObjectsListDto.builder()
                .foundObjects(result)
                // La categoría deducida del texto se devuelve para mostrarla read-only, igual que con foto.
                .category(category != null ? category.name() : null)
                .build();
    }

    /**
     * Búsqueda en vivo del rework (EU-324): unifica FOTO + TEXTO, ambos obligatorios. La foto se
     * vectoriza en memoria con CLIP (NO se sube a S3 —eso ocurre sólo al guardar la búsqueda,
     * decisión 8) y se clasifica en una categoría dura por IA (filtro previo + define α/β); el texto
     * se vectoriza con OpenAI. Se recuperan las dos similitudes por candidato ({@code queryDual}) y
     * se puntúa con {@link SearchScoringService#combinedScore} (α·sim_img + β·sim_txt, modulado por
     * geografía). La ubicación (organización o coordenadas) es OBLIGATORIA: sin ella no se puede
     * circunscribir el radio.
     */
    @SneakyThrows
    public FoundObjectsListDto searchByPhoto(MultipartFile image, String query, SimilarObjectsCommand filters) {
        // Foto + texto, ambos obligatorios (ver REWORK-ALGORITMO-BUSQUEDA, decisiones 3 y 324-D).
        if (image == null || image.isEmpty()) {
            throw new BadRequestException("image_required", "La foto es obligatoria para buscar.");
        }
        if (query == null || query.isBlank()) {
            throw new BadRequestException("description_required", "La descripción es obligatoria para buscar.");
        }
        // Ubicación obligatoria: organización o coordenadas (sin ella no hay radio geográfico).
        String orgIdStr = filters.getOrganizationId() != null ? filters.getOrganizationId().toString() : null;
        if (orgIdStr == null && (filters.getLatitude() == null || filters.getLongitude() == null)) {
            throw new BadRequestException("location_required",
                    "Debés indicar una organización o unas coordenadas para buscar.");
        }

        lostDateLimitService.validateLostDate(filters.getOrganizationId(), filters.getLostDate());

        byte[] imageBytes = image.getBytes();
        // Vector VISUAL (CLIP) en memoria y vector TEXTUAL (OpenAI).
        List<Float> imageEmbedding = imageEmbeddingService.getImageVectorRepresentation(imageBytes);
        List<Float> textEmbedding = embeddingService.getTextVectorRepresentation(TextNormalizer.normalize(query));

        /* EU-337: la categoría se decide por PRECEDENCIA, no por votación. Si el texto nombra el
         * objeto, decide el texto, diga lo que diga la foto; si no lo nombra, el clasificador de texto
         * se abstiene y decide la foto (que nunca viene vacía).
         *
         * Por qué precedencia y no "gana el más confiado": las dos confianzas NO son comparables. La
         * de la foto es un softmax sobre cosenos imagen-texto, que viven en una franja angosta por el
         * modality gap; los cosenos texto-texto viven en otro rango. Compararlas es comparar dos
         * termómetros en unidades distintas, y en silencio ganaría siempre uno. Con precedencia cada
         * señal se mide contra su propio umbral, en su propia escala, y los dos números nunca se
         * comparan entre sí.
         *
         * Y el orden es ese porque la foto es la señal FRÁGIL: está medido que parte pares (la
         * notebook caía en dos categorías distintas) y que sus márgenes son de centésimas. El texto,
         * cuando nombra el objeto, no deja lugar a la duda: el sustantivo ES la categoría. */
        ObjectCategory textCategory = textClassificationService.classify(query);
        ObjectCategory category = textCategory != null ? textCategory : imageClassificationService.classify(imageBytes);
        log.debug("searchByPhoto: categoria={} (por {})", category, textCategory != null ? "TEXTO" : "FOTO");

        GeoCoordinates queryCoordinates = null;
        if (orgIdStr != null && organizationRepository.existsById(filters.getOrganizationId())) {
            queryCoordinates = organizationRepository.findById(filters.getOrganizationId())
                    .get()
                    .getCoordinates();
        } else {
            queryCoordinates = GeoCoordinates.builder()
                    .latitude(filters.getLatitude())
                    .longitude(filters.getLongitude())
                    .build();
        }

        // Filtro DURO por categoría: la decide la IA desde la foto (no la elige el usuario). Sin poda
        // por límite ni umbral en la recuperación (limit alto, ver "Poda del universo" en EU-324).
        // EU-452: los objetos vencidos según el plazo de guarda de su organización no se ofrecen.
        List<FoundObject> foundObjects = storagePeriodService.excludeExpired(foundObjectRepository.queryDual(
                imageEmbedding, textEmbedding,
                orgIdStr, queryCoordinates, filters.getLostDate(), filters.getLostDateTo(), false,
                category.name(), SEARCH_CANDIDATE_LIMIT, null));

        log.debug("searchByPhoto: categoria={} candidatos recuperados={}", category, foundObjects.size());

        final GeoCoordinates finalCoords = queryCoordinates;
        for (FoundObject fo : foundObjects) {
            // Puntaje combinado imagen+texto modulado por geografía (SearchScoringService.combinedScore).
            double score = searchScoringService.combinedScore(fo.getImageCertainty(), fo.getTextCertainty(),
                    category, fo.getCoordinates(), finalCoords);
            fo.setScore((float) score);
            log.debug("searchByPhoto: candidato '{}' simImg={} simTxt={} score={} (umbral={})",
                    fo.getTitle(), fo.getImageCertainty(), fo.getTextCertainty(), score,
                    searchScoringService.matchThreshold(SearchScoringService.SearchMode.WITH_PHOTO));
            Double distance = CommonFunctions.calculateGeoDistance(fo.getCoordinates(), finalCoords);
            fo.setDistance(distance.floatValue());
        }

        List<FoundObjectDto> result = filterAndRemapByScore(foundObjects, SearchScoringService.SearchMode.WITH_PHOTO);

        return FoundObjectsListDto.builder()
                .foundObjects(result)
                // Categoría clasificada por IA: el front la muestra read-only (decisión 8bis).
                .category(category.name())
                .build();
    }

    /**
     * Paso final común de las búsquedas: se FILTRA por el umbral crudo del modo y recién después se remapea
     * el puntaje a la escala que ve el usuario (displayScore, EU-327). La curva es monótona, así que el
     * orden es el mismo de una u otra forma; filtrar antes deja el corte expresado en la escala en la que
     * fue calibrado. Devuelve los DTO ordenados de mayor a menor puntaje.
     */
    private List<FoundObjectDto> filterAndRemapByScore(List<FoundObject> foundObjects,
                                                       SearchScoringService.SearchMode mode) {
        return foundObjects.stream()
                .filter(fo -> fo.getScore() != null && searchScoringService.isCombinedMatch(fo.getScore(), mode))
                .map(dtoMapper::toDto)
                .map(dto -> {
                    dto.setScore((float) searchScoringService.displayScore(dto.getScore(), mode));
                    return dto;
                })
                .sorted(Comparator.comparing(FoundObjectDto::getScore, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }
}
