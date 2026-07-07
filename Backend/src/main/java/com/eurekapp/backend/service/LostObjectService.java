package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.command.ReportLostObjectCommand;
import com.eurekapp.backend.dto.response.LostObjectResponseDto;
import com.eurekapp.backend.exception.ApiException;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.*;
import java.util.Optional;
import com.eurekapp.backend.repository.*;
import java.time.LocalDateTime;
import com.eurekapp.backend.service.client.EmbeddingService;
import com.eurekapp.backend.service.client.ImageClassificationService;
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
        // La búsqueda del rework es foto + texto, ambos obligatorios (ver REWORK-ALGORITMO-BUSQUEDA).
        MultipartFile image = command.getImage();
        if (image == null || image.isEmpty()) {
            throw new BadRequestException("image_required", "La foto es obligatoria para guardar la búsqueda.");
        }
        if (command.getDescription() == null || command.getDescription().isBlank()) {
            throw new BadRequestException("description_required", "La descripción es obligatoria para guardar la búsqueda.");
        }

        byte[] imageBytes = image.getBytes();
        // EU-324: vector VISUAL (CLIP) + categoría dura por IA desde la imagen, y vector TEXTUAL (OpenAI)
        // de la descripción del usuario. Se persisten como los dos vectores nombrados "image"/"text".
        List<Float> imageEmbedding = imageEmbeddingService.getImageVectorRepresentation(imageBytes);
        ObjectCategory category = imageClassificationService.classify(imageBytes);
        List<Float> textEmbedding = embeddingService.getTextVectorRepresentation(command.getDescription());
        String id = UUID.randomUUID().toString();

        LostObject lostObject = LostObject.builder()
                .uuid(id)
                .username(command.getUsername())
                .imageEmbedding(imageEmbedding)
                .textEmbedding(textEmbedding)
                // Categoría dura determinada por IA desde la imagen (no la elige el usuario).
                .category(category.name())
                .coordinates(command.getGeoCoordinates())
                .organizationId(command.getOrganizationId())
                .description(command.getDescription())
                .lostDate(command.getLostDate())
                .build();

        lostObjectRepository.add(lostObject);

        // EU-324 / decisión 8: la foto de la búsqueda se sube a S3 SÓLO al guardar (key = uuid del
        // LostObject), para poder mostrarla al ver la búsqueda guardada. La búsqueda en vivo no sube nada.
        objectStorage.putObject(imageBytes, id);
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
        // Cross-org (orgId null): la cercanía la maneja el geoScore del puntaje. Sin poda por límite ni umbral
        // en la recuperación (limit alto, ver "Poda del universo" en EU-324).
        List<LostObject> candidates = lostObjectRepository.queryDual(imageEmbedding, textEmbedding,
                null, null, null, foundDate, SEARCH_CANDIDATE_LIMIT, null);

        // Puntuamos con el MISMO algoritmo que la búsqueda en vivo y nos quedamos con las que superan el umbral.
        // EU-292: las búsquedas CERRADAS no disparan avisos (el usuario ya recuperó / dejó de buscar).
        List<LostObject> matches = new ArrayList<>();
        for (LostObject candidate : candidates) {
            if (candidate.getStatus() == LostObjectStatus.CLOSED) {
                continue;
            }
            // Filtro DURO por categoría: nunca se notifica entre categorías distintas (decisión 5).
            if (ObjectCategory.fromLabel(candidate.getCategory()) != category) {
                continue;
            }
            double totalScore = searchScoringService.combinedScore(
                    candidate.getImageCertainty(), candidate.getTextCertainty(), category,
                    candidate.getCoordinates(), foundCoordinates);
            if (searchScoringService.isMatch(totalScore)) {
                candidate.setScore((float) totalScore);
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
                        .status(lo.getStatus() != null ? lo.getStatus().name() : LostObjectStatus.ACTIVE.name())
                        .closedDate(lo.getClosedDate())
                        .recovered(lo.getRecovered())
                        .build())
                .collect(Collectors.toList());
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
