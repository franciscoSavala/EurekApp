package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.LostObjectResponseDto;
import com.eurekapp.backend.dto.ReportLostObjectCommand;
import com.eurekapp.backend.exception.ApiException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.LostObjectStructVector;
import com.eurekapp.backend.model.LostObjectVectorFactory;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.SimpleEmailContentBuilder;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.ObjectStorage;
import com.eurekapp.backend.repository.VectorStorage;
import com.eurekapp.backend.service.client.EmbeddingService;
import com.eurekapp.backend.service.notification.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.UUID;

@Service
public class LostObjectService {

    private static final double MIN_SCORE = 0.6;
    private static final Logger log = LoggerFactory.getLogger(LostObjectService.class);

    private final EmbeddingService embeddingService;
    private final VectorStorage<LostObjectStructVector> lostObjectVectorStorage;
    private final SimpleEmailContentBuilder simpleEmailContentBuilder;
    private final NotificationService notificationService;
    private final IOrganizationRepository organizationRepository;
    private final ObjectStorage objectStorage;

    public LostObjectService(
            EmbeddingService embeddingService,
            VectorStorage<LostObjectStructVector> lostObjectVectorStorage,
            SimpleEmailContentBuilder simpleEmailContentBuilder,
            NotificationService notificationService,
            IOrganizationRepository organizationRepository,
            ObjectStorage objectStorage) {
        this.embeddingService = embeddingService;
        this.lostObjectVectorStorage = lostObjectVectorStorage;
        this.simpleEmailContentBuilder = simpleEmailContentBuilder;
        this.notificationService = notificationService;
        this.organizationRepository = organizationRepository;
        this.objectStorage = objectStorage;
    }

    public void reportLostObject(ReportLostObjectCommand command) {
        List<Float> embeddings = embeddingService.getTextVectorRepresentation(command.getDescription());
        String id = UUID.randomUUID().toString();
        LostObjectStructVector lostObjectStructVector = LostObjectStructVector.builder()
                .id(id)
                .description(command.getDescription())
                .username(command.getUsername())
                .embeddings(embeddings)
                .build();

        lostObjectVectorStorage.upsertVector(lostObjectStructVector);
    }

    public void findSimilarLostObject(
            List<Float> embeddings, Long organizationId, String description, String foundId) {
        LostObjectStructVector structVector = LostObjectStructVector.builder()
                .embeddings(embeddings)
                .build();

        List<LostObjectStructVector> lostObjects = lostObjectVectorStorage.queryVector(structVector);

        if(lostObjects.isEmpty() || lostObjects.getFirst().getScore() < MIN_SCORE) return;

        log.info("[action:similar_lost_object] Found={}", lostObjects.getFirst());

        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ApiException("should_exists_organization", "No sense", HttpStatus.INTERNAL_SERVER_ERROR));

        String imageUrl = objectStorage.getObjectUrl(foundId);
        String message = simpleEmailContentBuilder.buildEmailContent(
                organization.getName(), organization.getContactData(), description, imageUrl);

        notificationService.sendNotification(message);
    }
}
