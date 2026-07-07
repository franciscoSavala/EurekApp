package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.FoundObjectsListDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.model.FoundObject;
import com.eurekapp.backend.model.GeoCoordinates;
import com.eurekapp.backend.model.ObjectCategory;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.SimilarObjectsCommand;
import com.eurekapp.backend.model.UploadFoundObjectCommand;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.FoundObjectRepository;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.IRewardExclusionRepository;
import com.eurekapp.backend.repository.IUserRepository;
import com.eurekapp.backend.repository.ObjectStorage;
import com.eurekapp.backend.service.client.EmbeddingService;
import com.eurekapp.backend.service.client.ImageClassificationService;
import com.eurekapp.backend.service.client.ImageDescriptionService;
import com.eurekapp.backend.service.client.ImageEmbeddingService;
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
import java.util.List;
import java.util.concurrent.ExecutorService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
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
    @Mock ImageEmbeddingService imageEmbeddingService;
    @Mock ImageClassificationService imageClassificationService;
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
                s3Service, descriptionService, embeddingService, imageEmbeddingService,
                imageClassificationService, organizationRepository,
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

    // ---- searchByPhoto (EU-324-D): búsqueda en vivo = foto + texto + ubicación, con CLIP + categoría IA ----

    private static final GeoCoordinates CORDOBA =
            GeoCoordinates.builder().latitude(-31.4201).longitude(-64.1888).build();

    @Test
    void searchByPhoto_withoutQuery_throwsBadRequest() {
        MockMultipartFile photo = new MockMultipartFile("file", new byte[]{1, 2, 3});
        SimilarObjectsCommand filters = SimilarObjectsCommand.builder().organizationId(1L).build();

        assertThatThrownBy(() -> service.searchByPhoto(photo, "   ", filters))
                .isInstanceOf(BadRequestException.class);

        verify(foundObjectRepository, never())
                .queryDual(any(), any(), any(), any(), any(), any(), anyBoolean(), any(), anyInt(), any());
    }

    @Test
    void searchByPhoto_withoutLocation_throwsBadRequest() {
        MockMultipartFile photo = new MockMultipartFile("file", new byte[]{1, 2, 3});
        // Sin organización y sin coordenadas: no se puede circunscribir el radio.
        SimilarObjectsCommand filters = SimilarObjectsCommand.builder().build();

        assertThatThrownBy(() -> service.searchByPhoto(photo, "billetera marrón", filters))
                .isInstanceOf(BadRequestException.class);

        verify(foundObjectRepository, never())
                .queryDual(any(), any(), any(), any(), any(), any(), anyBoolean(), any(), anyInt(), any());
    }

    @Test
    void searchByPhoto_happyPath_classifiesVectorizesAndReturnsCategory() {
        MockMultipartFile photo = new MockMultipartFile("file", new byte[]{1, 2, 3});
        SimilarObjectsCommand filters = SimilarObjectsCommand.builder().organizationId(1L).build();

        Organization org = mock(Organization.class);
        when(org.getCoordinates()).thenReturn(CORDOBA);
        when(organizationRepository.existsById(1L)).thenReturn(true);
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(org));

        when(imageEmbeddingService.getImageVectorRepresentation(any())).thenReturn(List.of(0.4f, 0.5f));
        when(imageClassificationService.classify(any())).thenReturn(ObjectCategory.BILLETERA);
        when(embeddingService.getTextVectorRepresentation(anyString())).thenReturn(List.of(0.1f, 0.2f));

        FoundObject candidate = FoundObject.builder()
                .uuid("fo-1").title("Billetera marrón").humanDescription("cuero")
                .organizationId("1").coordinates(CORDOBA).foundDate(LocalDateTime.now())
                .imageCertainty(0.95f).textCertainty(0.9f).category(ObjectCategory.BILLETERA.name())
                .build();
        when(foundObjectRepository.queryDual(any(), any(), any(), any(), any(), any(), anyBoolean(), any(), anyInt(), any()))
                .thenReturn(List.of(candidate));

        // El puntaje combinado y el umbral los decide SearchScoringService (aquí mockeado).
        when(searchScoringService.combinedScore(any(), any(), any(), any(), any())).thenReturn(0.9);
        when(searchScoringService.isMatch(anyDouble())).thenReturn(true);
        when(s3Service.generatePresignedUrl(anyString(), any())).thenReturn("http://img/fo-1.jpg");

        FoundObjectsListDto result = service.searchByPhoto(photo, "billetera marrón", filters);

        // Devuelve la categoría clasificada por IA (para mostrarla read-only) y el candidato que superó el umbral.
        assertThat(result.getCategory()).isEqualTo(ObjectCategory.BILLETERA.name());
        assertThat(result.getFoundObjects()).hasSize(1);
        assertThat(result.getFoundObjects().get(0).getId()).isEqualTo("fo-1");
        // Recupera candidatos con AMBOS vectores (imagen + texto), no la query textual legacy.
        verify(foundObjectRepository)
                .queryDual(any(), any(), any(), any(), any(), any(), anyBoolean(), any(), anyInt(), any());
    }
}
