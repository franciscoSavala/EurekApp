package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.command.ReportLostObjectCommand;
import com.eurekapp.backend.dto.response.LostObjectResponseDto;
import com.eurekapp.backend.exception.ApiException;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.model.*;
import java.util.Optional;
import com.eurekapp.backend.repository.*;
import java.time.LocalDateTime;
import com.eurekapp.backend.service.client.EmbeddingService;
import com.eurekapp.backend.service.notification.NotificationService;
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

    private final EmbeddingService embeddingService;
    private final EmailTemplateService emailTemplateService;
    private final NotificationService notificationService;
    private final IOrganizationRepository organizationRepository;
    private final ObjectStorage objectStorage;
    private final LostObjectRepository lostObjectRepository;
    private final IUserRepository userRepository;
    private final InAppNotificationService inAppNotificationService;
    private final IReclamoRepository reclamoRepository;
    private final SearchScoringService searchScoringService;

    public LostObjectService(
            EmbeddingService embeddingService,
            EmailTemplateService emailTemplateService,
            NotificationService notificationService,
            IOrganizationRepository organizationRepository,
            ObjectStorage objectStorage,
            LostObjectRepository lostObjectRepository,
            IUserRepository userRepository,
            InAppNotificationService inAppNotificationService,
            IReclamoRepository reclamoRepository,
            SearchScoringService searchScoringService) {
        this.embeddingService = embeddingService;
        this.emailTemplateService = emailTemplateService;
        this.notificationService = notificationService;
        this.organizationRepository = organizationRepository;
        this.objectStorage = objectStorage;
        this.lostObjectRepository = lostObjectRepository;
        this.userRepository = userRepository;
        this.inAppNotificationService = inAppNotificationService;
        this.reclamoRepository = reclamoRepository;
        this.searchScoringService = searchScoringService;
    }

    // Este método se ejecuta cuando un usuario desea guardar una búsqueda para ser avisado cuando se encuentre un
    // similar a la publicación.
    public void reportLostObject(ReportLostObjectCommand command) {
        if (command.getDescription() == null || command.getDescription().isBlank()) {
            throw new BadRequestException("description_required", "No se pudo analizar la imagen para guardar la búsqueda.");
        }
        List<Float> embeddings = embeddingService.getTextVectorRepresentation(command.getDescription());
        String id = UUID.randomUUID().toString();

        // TODO: Agregar atributos faltantes. Chequear que estén siendo enviados desde el front.
        LostObject lostObject = LostObject.builder()
                .uuid(id)
                .username(command.getUsername())
                .embeddings(embeddings)
                .coordinates(command.getGeoCoordinates())
                .organizationId(command.getOrganizationId())
                .description(command.getDescription())
                .lostDate(command.getLostDate())
                .build();

        lostObjectRepository.add(lostObject);

        if (command.getOrganizationId() != null && command.getUsername() != null) {
            userRepository.findByUsername(command.getUsername()).ifPresent(user -> {
                LocalDateTime now = LocalDateTime.now();
                Reclamo reclamo = Reclamo.builder()
                        .organizationId(command.getOrganizationId())
                        .foundObjectUUID(null)
                        .user(user)
                        .claimDescription(command.getDescription())
                        .createdAt(now)
                        .updatedAt(now)
                        .build();
                reclamoRepository.save(reclamo);
            });
        }
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
        List<Float> embeddings = foundObject.getEmbeddings();
        GeoCoordinates foundCoordinates = foundObject.getCoordinates();
        LocalDateTime foundDate = foundObject.getFoundDate();

        // Traemos las búsquedas guardadas con lostDate ANTERIOR al foundDate (lostDateTo => lost_date < foundDate).
        // Cross-org (orgId null): la cercanía la maneja el geoScore del puntaje, igual que la búsqueda regular.
        List<LostObject> candidates = lostObjectRepository.query(embeddings, null, null, null, foundDate);

        // Puntuamos con el MISMO algoritmo que la búsqueda regular y nos quedamos con las que superan el umbral.
        List<LostObject> matches = new ArrayList<>();
        for (LostObject candidate : candidates) {
            double totalScore = searchScoringService.totalScore(
                    candidate.getScore(), candidate.getCoordinates(), foundCoordinates);
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
        List<LostObject> results = lostObjectRepository.query(null, username, null, null, null);
        return results.stream()
                .map(lo -> LostObjectResponseDto.builder()
                        .uuid(lo.getUuid())
                        .description(lo.getDescription())
                        .lostDate(lo.getLostDate())
                        .organizationId(lo.getOrganizationId())
                        .build())
                .collect(Collectors.toList());
    }
}
