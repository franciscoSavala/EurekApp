package com.eurekapp.backend.service;

import com.eurekapp.backend.util.TextNormalizer;
import com.eurekapp.backend.dto.command.ReportLostObjectCommand;
import com.eurekapp.backend.dto.response.LostObjectResponseDto;
import com.eurekapp.backend.exception.ApiException;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.*;
import java.util.Optional;
import com.eurekapp.backend.repository.*;
import java.time.Duration;
import java.time.LocalDateTime;
import com.eurekapp.backend.service.client.EmbeddingService;
import com.eurekapp.backend.service.client.ImageClassificationService;
import com.eurekapp.backend.service.client.TextClassificationService;
import com.eurekapp.backend.service.client.ImageEmbeddingService;
import com.eurekapp.backend.service.notification.NotificationService;
import lombok.SneakyThrows;
import org.springframework.web.multipart.MultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class LostObjectService {

    private static final Logger log = LoggerFactory.getLogger(LostObjectService.class);

    /**
     * EU-324: límite altísimo para la recuperación de candidatos ({@code queryDual}). No es poda: es
     * un fusible defensivo que a la escala real del producto nunca se alcanza (ver EU-324-SUBTAREAS).
     */
    private static final int SEARCH_CANDIDATE_LIMIT = 5000;

    private final EmbeddingService embeddingService;
    private final ImageEmbeddingService imageEmbeddingService;
    private final ImageClassificationService imageClassificationService;
    /** EU-337: clasificador por TEXTO, con precedencia sobre el de la foto. */
    private final TextClassificationService textClassificationService;
    private final EmailTemplateService emailTemplateService;
    private final NotificationService notificationService;
    private final IOrganizationRepository organizationRepository;
    private final ObjectStorage objectStorage;
    private final LostObjectRepository lostObjectRepository;
    private final IUserRepository userRepository;
    private final InAppNotificationService inAppNotificationService;
    private final SearchScoringService searchScoringService;

    public LostObjectService(
            EmbeddingService embeddingService,
            ImageEmbeddingService imageEmbeddingService,
            ImageClassificationService imageClassificationService,
            TextClassificationService textClassificationService,
            EmailTemplateService emailTemplateService,
            NotificationService notificationService,
            IOrganizationRepository organizationRepository,
            ObjectStorage objectStorage,
            LostObjectRepository lostObjectRepository,
            IUserRepository userRepository,
            InAppNotificationService inAppNotificationService,
            SearchScoringService searchScoringService) {
        this.embeddingService = embeddingService;
        this.imageEmbeddingService = imageEmbeddingService;
        this.imageClassificationService = imageClassificationService;
        this.textClassificationService = textClassificationService;
        this.emailTemplateService = emailTemplateService;
        this.notificationService = notificationService;
        this.organizationRepository = organizationRepository;
        this.objectStorage = objectStorage;
        this.lostObjectRepository = lostObjectRepository;
        this.userRepository = userRepository;
        this.inAppNotificationService = inAppNotificationService;
        this.searchScoringService = searchScoringService;
    }

    // Este método se ejecuta cuando un usuario desea guardar una búsqueda para ser avisado cuando se encuentre un
    // similar a la publicación.
    @SneakyThrows
    public void reportLostObject(ReportLostObjectCommand command) {
        // EU-326: la descripción es obligatoria; la FOTO es opcional. Guardar sin foto deja una búsqueda
        // más débil (sin vector visual y sin categoría), pero es preferible a no poder guardarla: el front
        // recomienda adjuntar una foto —aunque sea de internet— porque sube las chances de que matchee.
        MultipartFile image = command.getImage();
        if (command.getDescription() == null || command.getDescription().isBlank()) {
            throw new BadRequestException("description_required", "La descripción es obligatoria para guardar la búsqueda.");
        }
        boolean hasImage = image != null && !image.isEmpty();

        byte[] imageBytes = hasImage ? image.getBytes() : null;
        // EU-324: vector VISUAL (CLIP) + categoría dura por IA desde la imagen, y vector TEXTUAL (OpenAI)
        // de la descripción del usuario. Se persisten como los dos vectores nombrados "image"/"text".
        // Sin foto no hay ninguno de los dos: la búsqueda queda sólo con el vector textual.
        List<Float> imageEmbedding = hasImage
                ? imageEmbeddingService.getImageVectorRepresentation(imageBytes) : null;
        /* EU-337: la categoría sale del TEXTO con precedencia sobre la foto, igual que en la búsqueda
         * y en el alta de un objeto encontrado. Es lo que cierra el hueco que había dejado EU-326: una
         * búsqueda guardada SIN foto no tenía categoría y quedaba compitiendo a ciegas. Si el texto no
         * nombra el objeto, decide la foto; y si tampoco hay foto, queda DESCONOCIDA (null). */
        ObjectCategory textCategory = textClassificationService.classify(command.getDescription());
        ObjectCategory category = textCategory != null
                ? textCategory
                : (hasImage ? imageClassificationService.classify(imageBytes) : null);
        // EU-142: se normaliza SÓLO el texto que alimenta el vector; la descripción se persiste tal cual.
        List<Float> textEmbedding = embeddingService.getTextVectorRepresentation(
                TextNormalizer.normalize(command.getDescription()));
        String id = UUID.randomUUID().toString();

        // EU-324 / decisión 8: la foto de la búsqueda se sube a S3 SÓLO al guardar (key = uuid del
        // LostObject), para poder mostrarla al ver la búsqueda guardada. La búsqueda en vivo no sube nada.
        //
        // EU-343: se sube ANTES de persistir, y hasImage refleja si la subida funcionó de verdad.
        // Antes se persistía hasImage=true y se subía después: si S3 fallaba, el registro quedaba
        // afirmando que tenía foto y "Mis búsquedas" mostraba para siempre un recuadro roto,
        // porque pedía la URL de un objeto inexistente.
        //
        // Un fallo de S3 no cancela el guardado: desde EU-326 la foto es opcional, así que es
        // preferible conservar la búsqueda (con su vector visual, que igual se calculó) y mostrar
        // el placeholder "sin foto", antes que hacerle perder la búsqueda al usuario.
        boolean imageStored = false;
        if (hasImage) {
            try {
                objectStorage.putObject(imageBytes, id);
                imageStored = true;
            } catch (RuntimeException e) {
                log.error("LostObjectService: no se pudo subir la foto de la búsqueda '{}'. "
                        + "Se guarda igual, sin foto.", id, e);
            }
        }

        LostObject lostObject = LostObject.builder()
                .uuid(id)
                .username(command.getUsername())
                .imageEmbedding(imageEmbedding)
                .textEmbedding(textEmbedding)
                // Categoría dura determinada por IA (texto con precedencia sobre la foto; no la elige
                // el usuario). Si ninguna de las dos alcanza queda DESCONOCIDA (null): ver
                // notifyMatchingSavedSearches, que en ese caso no filtra por categoría.
                .category(category != null ? category.name() : null)
                .coordinates(command.getGeoCoordinates())
                .organizationId(command.getOrganizationId())
                .description(command.getDescription())
                .lostDate(command.getLostDate())
                .hasImage(imageStored)
                .build();

        lostObjectRepository.add(lostObject);
    }

    /**
     * Búsqueda INVERSA (EU-279): al subir un objeto encontrado, busca las búsquedas guardadas
     * ({@link LostObject}) que coinciden con él y notifica (email + in-app) a sus dueños.
     *
     * <p>Es el espejo exacto de la búsqueda regular: usa el MISMO algoritmo de puntaje
     * ({@link SearchScoringService}, texto + geografía, umbral 0,75) y considera únicamente las
     * búsquedas cuya fechaHora de pérdida ({@code lostDate}) es ANTERIOR a la fechaHora en que se
     * encontró el objeto ({@code foundDate}). El alcance es cross-org: la cercanía la pondera el
     * componente geográfico del puntaje (el filtro duro de radio está deshabilitado por un bug de
     * Weaviate, ver EU-301).</p>
     *
     * <p>A cada usuario se le envía UN solo aviso con la lista de TODAS sus búsquedas coincidentes.
     * Sólo se notifica a usuarios finales (rol {@link Role#USER}).</p>
     *
     * @param foundObject objeto encontrado recién cargado (con embeddings, coordenadas y fecha).
     */
    public void notifyMatchingSavedSearches(FoundObject foundObject) {
        // EU-324: la búsqueda inversa (found→lost) espeja la búsqueda en vivo: combina las DOS
        // modalidades (vector "image" de CLIP + vector "text" de OpenAI) y puntúa con combinedScore.
        List<Float> imageEmbedding = foundObject.getImageEmbedding();
        List<Float> textEmbedding = foundObject.getTextEmbedding();
        GeoCoordinates foundCoordinates = foundObject.getCoordinates();
        LocalDateTime foundDate = foundObject.getFoundDate();
        // Categoría dura del objeto encontrado: define α/β y es filtro previo (nunca se cruza entre categorías).
        ObjectCategory category = ObjectCategory.fromLabel(foundObject.getCategory());

        // Traemos las búsquedas guardadas con lostDate ANTERIOR al foundDate (lostDateTo => lost_date < foundDate).
        // Cross-org (orgId null) PERO acotado por radio geográfico duro (EU-320): centro = ubicación del objeto
        // encontrado; sólo se consideran búsquedas dentro del radio. Sin poda por límite ni umbral en la
        // recuperación (limit alto, ver "Poda del universo" en EU-324).
        List<LostObject> candidates = lostObjectRepository.queryDual(imageEmbedding, textEmbedding,
                null, null, foundCoordinates, null, foundDate, SEARCH_CANDIDATE_LIMIT, null);

        // Puntuamos con el MISMO algoritmo que la búsqueda en vivo y nos quedamos con las que superan el umbral.
        // EU-292: las búsquedas CERRADAS no disparan avisos (el usuario ya recuperó / dejó de buscar).
        List<LostObject> matches = new ArrayList<>();
        for (LostObject candidate : candidates) {
            if (candidate.getStatus() == LostObjectStatus.CLOSED) {
                continue;
            }
            // Filtro DURO por categoría: nunca se notifica entre categorías distintas (decisión 5).
            // EU-326: una búsqueda guardada SIN foto no tiene categoría, y "desconocida" no es lo mismo
            // que "distinta". Descartarla la volvería invisible para siempre y en silencio, que es
            // justamente el fallo que el filtro duro busca evitar; por eso se la deja pasar y decide el
            // umbral. Sólo puede aportar texto, así que llega al corte por su propio mérito o no llega.
            if (hasKnownCategory(candidate.getCategory())
                    && ObjectCategory.fromLabel(candidate.getCategory()) != category) {
                continue;
            }
            double totalScore = searchScoringService.combinedScore(
                    candidate.getImageCertainty(), candidate.getTextCertainty(), category,
                    candidate.getCoordinates(), foundCoordinates);
            /* EU-327: el corte va contra el umbral CRUDO calibrado; lo que se guarda para mostrar o
             * notificar es el puntaje ya remapeado a la escala del usuario.
             * EU-337: el modo lo decide la búsqueda GUARDADA, no el objeto encontrado. Una búsqueda sin
             * foto se puntúa con una sola señal y por lo tanto vive en la otra escala: usarle el umbral
             * de la búsqueda con foto la mediría con una vara que no es la suya. */
            SearchScoringService.SearchMode mode = candidate.getImageCertainty() != null
                    ? SearchScoringService.SearchMode.WITH_PHOTO
                    : SearchScoringService.SearchMode.TEXT_ONLY;
            if (searchScoringService.isCombinedMatch(totalScore, mode)) {
                candidate.setScore((float) searchScoringService.displayScore(totalScore, mode));
                matches.add(candidate);
            }
        }

        if (matches.isEmpty()) {
            log.info("LostObjectService: ninguna búsqueda guardada coincidió con el objeto encontrado {}.",
                    foundObject.getUuid());
            return;
        }

        // Agrupamos por usuario: a cada uno un solo aviso con TODAS sus búsquedas coincidentes.
        Map<String, List<LostObject>> matchesByUsername = matches.stream()
                .collect(Collectors.groupingBy(LostObject::getUsername));

        // Datos comunes del objeto encontrado para el mensaje.
        Organization organization = organizationRepository.findById(Long.valueOf(foundObject.getOrganizationId()))
                .orElseThrow(() -> new ApiException("should_exists_organization", "No sense", HttpStatus.INTERNAL_SERVER_ERROR));
        String imageUrl = objectStorage.getObjectUrl(foundObject.getUuid());

        for (Map.Entry<String, List<LostObject>> entry : matchesByUsername.entrySet()) {
            String username = entry.getKey();

            // Solo notificamos a usuarios finales (rol USER); los roles internos de org no realizan búsquedas.
            Optional<UserEurekapp> recipientOpt = userRepository.findByUsername(username);
            if (recipientOpt.isEmpty() || recipientOpt.get().getRole() != Role.USER) {
                log.info("LostObjectService: se omite la notificación — el destinatario '{}' no es un USER.", username);
                continue;
            }
            UserEurekapp recipient = recipientOpt.get();

            // Descripciones de SUS búsquedas guardadas que coincidieron.
            List<String> matchingSearchDescriptions = entry.getValue().stream()
                    .map(LostObject::getDescription)
                    .toList();

            // Email.
            String message = emailTemplateService.buildObjectMatchFoundEmail(
                    organization.getName(), organization.getContactData(), matchingSearchDescriptions, imageUrl);
            notificationService.sendNotification(username,
                    "¡Alguien podría haber encontrado tu objeto! — EurekApp", message);

            // Notificación in-app.
            String inAppDescription = "Este objeto coincide con estas búsquedas abiertas: "
                    + String.join("; ", matchingSearchDescriptions);
            inAppNotificationService.createNotification(
                    recipient,
                    "Alguien podría haber encontrado tu objeto",
                    inAppDescription,
                    "MATCH_FOUND",
                    null);
        }
    }

    /**
     * EU-326: {@code true} si la búsqueda guardada tiene una categoría dura conocida. Las búsquedas
     * guardadas sin foto no la tienen (se persiste vacía), y "desconocida" no habilita el filtro duro.
     */
    private static boolean hasKnownCategory(String category) {
        return category != null && !category.isBlank();
    }

    public List<LostObjectResponseDto> getMyLostObjects(String username) {
        // EU-292: devuelve TODAS las búsquedas del usuario (activas y cerradas); el front las
        // diferencia por "status". Una sola fuente: ya no hay reclamo-espejo.
        List<LostObject> results = lostObjectRepository.query(null, username, null, null, null);
        return results.stream()
                .map(lo -> LostObjectResponseDto.builder()
                        .uuid(lo.getUuid())
                        .description(lo.getDescription())
                        .lostDate(lo.getLostDate())
                        .organizationId(lo.getOrganizationId())
                        .organizationName(resolveOrganizationName(lo.getOrganizationId()))
                        .category(lo.getCategory())
                        .status(lo.getStatus() != null ? lo.getStatus().name() : LostObjectStatus.ACTIVE.name())
                        .closedDate(lo.getClosedDate())
                        .recovered(lo.getRecovered())
                        // EU-326: la foto vive en S3 con key = uuid de la búsqueda, y sólo existe si
                        // se guardó con foto. Sin ella no se pide URL: sería un enlace roto.
                        // EU-343: el bucket es privado, así que la URL pública plana que devuelve
                        // getObjectUrl() da 403 y la imagen se ve como un recuadro vacío. Hay que
                        // firmarla, igual que FoundObjectService al listar objetos encontrados.
                        .imageUrl(Boolean.TRUE.equals(lo.getHasImage())
                                ? objectStorage.generatePresignedUrl(lo.getUuid(), Duration.ofHours(1)) : null)
                        .build())
                .collect(Collectors.toList());
    }

    /**
     * Nombre de la organización de una búsqueda guardada, para mostrarlo en lugar del id.
     *
     * <p>Devuelve null cuando la búsqueda no tiene organización (se perdió en la vía pública) y
     * también cuando el id no resuelve: es un dato de presentación, así que no vale hacer fallar
     * el listado entero de búsquedas del usuario por una organización que ya no está.
     */
    private String resolveOrganizationName(String organizationId) {
        if (organizationId == null || organizationId.isBlank()) return null;
        try {
            return organizationRepository.findById(Long.valueOf(organizationId))
                    .map(Organization::getName)
                    .orElse(null);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * EU-292: cierre LÓGICO de una búsqueda guardada por su dueño.
     *
     * <p>Sólo el usuario que la creó puede cerrarla. El cierre es terminal: una búsqueda ya cerrada
     * no se reabre (se rechaza con 400; el usuario debe crear una nueva). La respuesta a
     * "¿Recuperaste tu objeto? Sí/No" ({@code recovered}) se guarda en la propia búsqueda
     * ({@link LostObject#getRecovered()}); NO es un {@link SearchFeedback} (que es otra feature).</p>
     */
    public void closeLostObject(String username, String uuid, boolean recovered) {
        LostObject lostObject = lostObjectRepository.getByUuid(uuid);
        // Si no existe o no es del usuario, lo tratamos como "no encontrado" (no se filtra ajeno).
        if (lostObject == null || !username.equals(lostObject.getUsername())) {
            throw new NotFoundException("lost_object_not_found", "No se encontró la búsqueda guardada.");
        }
        if (lostObject.getStatus() == LostObjectStatus.CLOSED) {
            throw new BadRequestException("lost_object_already_closed",
                    "Esta búsqueda ya está cerrada. Si seguís buscando, creá una nueva.");
        }

        lostObjectRepository.close(uuid, LocalDateTime.now(), recovered);
    }
}
