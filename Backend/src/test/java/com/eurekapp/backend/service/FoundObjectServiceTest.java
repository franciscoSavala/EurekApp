package com.eurekapp.backend.service;

import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UploadFoundObjectCommand;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.FoundObjectRepository;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.IRewardExclusionRepository;
import com.eurekapp.backend.repository.IUserRepository;
import com.eurekapp.backend.repository.ObjectStorage;
import com.eurekapp.backend.service.client.EmbeddingService;
import com.eurekapp.backend.service.client.ImageDescriptionService;
import com.eurekapp.backend.service.notification.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mock.web.MockMultipartFile;

import java.time.LocalDateTime;
import java.util.concurrent.ExecutorService;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests del alta de objeto encontrado (EU-286, pieza de validación de bloqueo en alta): un finder
 * bloqueado por sospecha de fraude no puede depositar objetos.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FoundObjectServiceTest {

    @Mock ObjectStorage s3Service;
    @Mock ImageDescriptionService descriptionService;
    @Mock EmbeddingService embeddingService;
    @Mock IOrganizationRepository organizationRepository;
    @Mock OrganizationService organizationService;
    @Mock LostObjectService lostObjectService;
    @Mock ExecutorService executorService;
    @Mock FoundObjectRepository foundObjectRepository;
    @Mock IUserRepository userRepository;
    @Mock IRewardExclusionRepository rewardExclusionRepository;
    @Mock NotificationService notificationService;
    @Mock EmailTemplateService emailTemplateService;
    @Mock FraudBlockService fraudBlockService;
    @Mock SearchScoringService searchScoringService;

    FoundObjectService service;

    @BeforeEach
    void setUp() {
        service = new FoundObjectService(
                s3Service, descriptionService, embeddingService, organizationRepository,
                organizationService, lostObjectService, executorService, foundObjectRepository,
                userRepository, rewardExclusionRepository, notificationService,
                emailTemplateService, fraudBlockService, searchScoringService);
    }

    @Test
    void uploadFails_whenFinderIsBlocked() {
        UserEurekapp finder = UserEurekapp.builder()
                .id(99L).username("finder@test.com").firstName("Fin").lastName("Der")
                .role(Role.USER).build();

        UploadFoundObjectCommand command = UploadFoundObjectCommand.builder()
                .title("Mochila azul")
                .objectFinderUsername("finder@test.com")
                .foundDate(LocalDateTime.now().minusDays(1))
                .detailedDescription("desc")
                .organizationId(1L)
                .image(new MockMultipartFile("img", new byte[]{1, 2, 3}))
                .build();

        when(organizationRepository.existsById(1L)).thenReturn(true);
        when(userRepository.existsByUsername("finder@test.com")).thenReturn(true);
        when(userRepository.getByUsername("finder@test.com")).thenReturn(finder);
        // El finder está bloqueado por sospecha de fraude (con mensaje humano).
        when(fraudBlockService.describeActiveUserBlock(eq(99L), anyString()))
                .thenReturn(Optional.of("Quien encontró este objeto está temporalmente bloqueado."));

        assertThatThrownBy(() -> service.uploadFoundObject(command))
                .isInstanceOf(BadRequestException.class);

        // Se rechaza antes de persistir el objeto.
        verify(foundObjectRepository, never()).add(any());
    }
}
