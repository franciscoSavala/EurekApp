package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.command.ReportLostObjectCommand;
import com.eurekapp.backend.dto.response.LostObjectResponseDto;
import com.eurekapp.backend.exception.ApiException;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.repository.*;
import java.time.LocalDateTime;
import com.eurekapp.backend.service.client.EmbeddingService;
import com.eurekapp.backend.service.notification.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class LostObjectService {

    private static final double MIN_SCORE = 0.0;
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

    public LostObjectService(
            EmbeddingService embeddingService,
            EmailTemplateService emailTemplateService,
            NotificationService notificationService,
            IOrganizationRepository organizationRepository,
            ObjectStorage objectStorage,
            LostObjectRepository lostObjectRepository,
            IUserRepository userRepository,
            InAppNotificationService inAppNotificationService,
            IReclamoRepository reclamoRepository) {
        this.embeddingService = embeddingService;
        this.emailTemplateService = emailTemplateService;
        this.notificationService = notificationService;
        this.organizationRepository = organizationRepository;
        this.objectStorage = objectStorage;
        this.lostObjectRepository = lostObjectRepository;
        this.userRepository = userRepository;
        this.inAppNotificationService = inAppNotificationService;
        this.reclamoRepository = reclamoRepository;
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
                        .status(ClaimStatus.PENDIENTE)
                        .createdAt(now)
                        .updatedAt(now)
                        .build();
                reclamoRepository.save(reclamo);
            });
        }
    }

    // TODO: Agregar a los argumentos la ubicación y la fecha en la que fue encontrado.
    /**
     * Este método tiene como finalidad buscar publicaciones de objetos perdidos que tengan un cierto grado de
     *         coincidencia con un objeto encontrado, cuyos datos relevantes son pasados como parámetros.
     *         El grado mínimo de coincidencia viene dado por MIN_SCORE.
     * @param embeddings
     * @param organizationId
     * @param description
     * @param foundId
     */
    public void findSimilarLostObject(
            List<Float> embeddings, Long organizationId, String description, String foundId) {
        // TODO: Agregar las coordenadas del FoundObject a la query, para que sólo busque coincidencias dentro de cierto
        //      radio.

        // Buscamos publicaciones de LostObject que tengan un cierto grado de coincidencia.
        List<LostObject> lostObjects = lostObjectRepository.query(embeddings, null, null, null, null);

        // Si la query vuelve vacía, o devuelve algo pero ningún LostObject llega al puntaje mínimo, terminar el método.
        if(lostObjects.isEmpty() || lostObjects.getFirst().getScore() < MIN_SCORE) {
            log.info("LostObjectService: Couldn't find any LostObjects similar to the uploaded FoundObject. ");
            return;
        }

        // Obtenemos la organización que está reteniendo actualmente el objeto encontrado.
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ApiException("should_exists_organization", "No sense", HttpStatus.INTERNAL_SERVER_ERROR));

        // Obtenemos la imagen del objeto encontrado
        String imageUrl = objectStorage.getObjectUrl(foundId);

        // Elaboramos la notificación que enviaremos
        String message = emailTemplateService.buildObjectFoundEmail(
                organization.getName(), organization.getContactData(), description, imageUrl);

        notificationService.sendNotification(lostObjects.getFirst().getUsername(), "¡Hemos encontrado tu objeto! — EurekApp", message);

        userRepository.findByUsername(lostObjects.getFirst().getUsername()).ifPresent(user ->
                inAppNotificationService.createNotification(
                        user,
                        "¡Posible coincidencia encontrada!",
                        "Se encontró un objeto en " + organization.getName() + " que podría ser el tuyo: " + description,
                        "MATCH_FOUND",
                        null
                )
        );
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
