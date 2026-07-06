package com.eurekapp.backend.service;

import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.FoundObject;
import com.eurekapp.backend.model.GeoCoordinates;
import com.eurekapp.backend.model.LostObject;
import com.eurekapp.backend.model.LostObjectStatus;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.IUserRepository;
import com.eurekapp.backend.repository.LostObjectRepository;
import com.eurekapp.backend.repository.ObjectStorage;
import com.eurekapp.backend.service.client.EmbeddingService;
import com.eurekapp.backend.service.notification.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests de la búsqueda INVERSA (EU-279): al subir un objeto encontrado, se avisa a los dueños de
 * las búsquedas guardadas que coinciden (≥ umbral), uno por usuario con la lista de sus búsquedas.
 * Se usa el {@link SearchScoringService} real para que el corte 0,75 sea el de producción.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LostObjectServiceTest {

    private static final GeoCoordinates CORDOBA =
            GeoCoordinates.builder().latitude(-31.4201).longitude(-64.1888).build();
    private static final GeoCoordinates BUENOS_AIRES =
            GeoCoordinates.builder().latitude(-34.6037).longitude(-58.3816).build();

    @Mock EmbeddingService embeddingService;
    @Mock EmailTemplateService emailTemplateService;
    @Mock NotificationService notificationService;
    @Mock IOrganizationRepository organizationRepository;
    @Mock ObjectStorage objectStorage;
    @Mock LostObjectRepository lostObjectRepository;
    @Mock IUserRepository userRepository;
    @Mock InAppNotificationService inAppNotificationService;

    LostObjectService service;

    @BeforeEach
    void setUp() {
        service = new LostObjectService(
                embeddingService, emailTemplateService, notificationService, organizationRepository,
                objectStorage, lostObjectRepository, userRepository, inAppNotificationService,
                new SearchScoringService(new com.eurekapp.backend.configuration.ScoringProperties()));

        Organization organization = mock(Organization.class);
        when(organization.getName()).thenReturn("Org Test");
        when(organization.getContactData()).thenReturn("contacto@org.com");
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(organization));
        when(objectStorage.getObjectUrl(anyString())).thenReturn("http://img/found.jpg");
        when(emailTemplateService.buildObjectMatchFoundEmail(any(), any(), any(), any()))
                .thenReturn("<html>email</html>");
    }

    @Test
    void match_aboveThreshold_notifiesOwner() {
        FoundObject found = foundObjectAt(CORDOBA);
        LostObject search = savedSearch("u1@test.com", "mochila azul", 1.0f, CORDOBA);
        when(lostObjectRepository.query(any(), any(), any(), any(), any())).thenReturn(List.of(search));
        when(userRepository.findByUsername("u1@test.com"))
                .thenReturn(Optional.of(user("u1@test.com", Role.USER)));

        service.notifyMatchingSavedSearches(found);

        verify(notificationService).sendNotification(eq("u1@test.com"), anyString(), anyString());
        verify(inAppNotificationService)
                .createNotification(any(UserEurekapp.class), anyString(), anyString(), eq("MATCH_FOUND"), isNull());
    }

    @Test
    void match_belowThreshold_doesNotNotify() {
        FoundObject found = foundObjectAt(CORDOBA);
        // Coseno bajo (0.6 => normalizado 0.2 => 0.19) y lejos => total muy por debajo de 0,75.
        LostObject search = savedSearch("u1@test.com", "algo", 0.6f, BUENOS_AIRES);
        when(lostObjectRepository.query(any(), any(), any(), any(), any())).thenReturn(List.of(search));

        service.notifyMatchingSavedSearches(found);

        verify(notificationService, never()).sendNotification(any(), any(), any());
        verify(inAppNotificationService, never()).createNotification(any(), any(), any(), any(), any());
    }

    @Test
    void multipleUsers_eachNotifiedOnce() {
        FoundObject found = foundObjectAt(CORDOBA);
        LostObject s1 = savedSearch("u1@test.com", "mochila", 1.0f, CORDOBA);
        LostObject s2 = savedSearch("u2@test.com", "cartera", 1.0f, CORDOBA);
        when(lostObjectRepository.query(any(), any(), any(), any(), any())).thenReturn(List.of(s1, s2));
        when(userRepository.findByUsername("u1@test.com"))
                .thenReturn(Optional.of(user("u1@test.com", Role.USER)));
        when(userRepository.findByUsername("u2@test.com"))
                .thenReturn(Optional.of(user("u2@test.com", Role.USER)));

        service.notifyMatchingSavedSearches(found);

        verify(notificationService).sendNotification(eq("u1@test.com"), anyString(), anyString());
        verify(notificationService).sendNotification(eq("u2@test.com"), anyString(), anyString());
        verify(notificationService, times(2)).sendNotification(any(), any(), any());
        verify(inAppNotificationService, times(2))
                .createNotification(any(), any(), any(), eq("MATCH_FOUND"), isNull());
    }

    @Test
    @SuppressWarnings("unchecked")
    void sameUser_multipleMatches_singleNotificationListingAll() {
        FoundObject found = foundObjectAt(CORDOBA);
        LostObject s1 = savedSearch("u1@test.com", "mochila azul", 1.0f, CORDOBA);
        LostObject s2 = savedSearch("u1@test.com", "cartera negra", 1.0f, CORDOBA);
        when(lostObjectRepository.query(any(), any(), any(), any(), any())).thenReturn(List.of(s1, s2));
        when(userRepository.findByUsername("u1@test.com"))
                .thenReturn(Optional.of(user("u1@test.com", Role.USER)));

        service.notifyMatchingSavedSearches(found);

        // Un solo aviso para el usuario, aunque tenga dos búsquedas coincidentes.
        verify(notificationService, times(1)).sendNotification(eq("u1@test.com"), anyString(), anyString());

        // El email recibe la lista con AMBAS búsquedas.
        ArgumentCaptor<List<String>> listCaptor = ArgumentCaptor.forClass(List.class);
        verify(emailTemplateService)
                .buildObjectMatchFoundEmail(any(), any(), listCaptor.capture(), any());
        assertThat(listCaptor.getValue()).containsExactlyInAnyOrder("mochila azul", "cartera negra");

        // La notificación in-app también las lista a ambas.
        ArgumentCaptor<String> descCaptor = ArgumentCaptor.forClass(String.class);
        verify(inAppNotificationService)
                .createNotification(any(), anyString(), descCaptor.capture(), eq("MATCH_FOUND"), isNull());
        assertThat(descCaptor.getValue()).contains("mochila azul").contains("cartera negra");
    }

    @Test
    void nonUserRecipient_isSkipped() {
        FoundObject found = foundObjectAt(CORDOBA);
        LostObject search = savedSearch("owner@org.com", "mochila", 1.0f, CORDOBA);
        when(lostObjectRepository.query(any(), any(), any(), any(), any())).thenReturn(List.of(search));
        when(userRepository.findByUsername("owner@org.com"))
                .thenReturn(Optional.of(user("owner@org.com", Role.ORGANIZATION_OWNER)));

        service.notifyMatchingSavedSearches(found);

        verify(notificationService, never()).sendNotification(any(), any(), any());
        verify(inAppNotificationService, never()).createNotification(any(), any(), any(), any(), any());
    }

    @Test
    void noCandidates_doesNotNotify() {
        FoundObject found = foundObjectAt(CORDOBA);
        when(lostObjectRepository.query(any(), any(), any(), any(), any())).thenReturn(List.of());

        service.notifyMatchingSavedSearches(found);

        verify(notificationService, never()).sendNotification(any(), any(), any());
        verify(inAppNotificationService, never()).createNotification(any(), any(), any(), any(), any());
    }

    @Test
    void closedSearch_isNotNotified() {
        FoundObject found = foundObjectAt(CORDOBA);
        LostObject search = savedSearch("u1@test.com", "mochila azul", 1.0f, CORDOBA);
        search.setStatus(LostObjectStatus.CLOSED); // ya cerrada => no debe disparar aviso
        when(lostObjectRepository.query(any(), any(), any(), any(), any())).thenReturn(List.of(search));

        service.notifyMatchingSavedSearches(found);

        verify(notificationService, never()).sendNotification(any(), any(), any());
        verify(inAppNotificationService, never()).createNotification(any(), any(), any(), any(), any());
    }

    @Test
    void close_byOwner_closesWithRecoveredAnswer() {
        LostObject search = savedSearch("u1@test.com", "mochila azul", 1.0f, CORDOBA);
        search.setStatus(LostObjectStatus.ACTIVE);
        when(lostObjectRepository.getByUuid(search.getUuid())).thenReturn(search);

        service.closeLostObject("u1@test.com", search.getUuid(), true);

        // El "¿lo recuperaste?" se guarda en la propia búsqueda; no se crea ningún SearchFeedback.
        verify(lostObjectRepository).close(eq(search.getUuid()), any(LocalDateTime.class), eq(true));
    }

    @Test
    void close_byNonOwner_throwsNotFoundAndDoesNotClose() {
        LostObject search = savedSearch("owner@test.com", "mochila", 1.0f, CORDOBA);
        when(lostObjectRepository.getByUuid(search.getUuid())).thenReturn(search);

        assertThatThrownBy(() -> service.closeLostObject("intruso@test.com", search.getUuid(), true))
                .isInstanceOf(NotFoundException.class);

        verify(lostObjectRepository, never()).close(any(), any(), anyBoolean());
    }

    @Test
    void close_alreadyClosed_throwsBadRequest() {
        LostObject search = savedSearch("u1@test.com", "mochila", 1.0f, CORDOBA);
        search.setStatus(LostObjectStatus.CLOSED);
        when(lostObjectRepository.getByUuid(search.getUuid())).thenReturn(search);

        assertThatThrownBy(() -> service.closeLostObject("u1@test.com", search.getUuid(), false))
                .isInstanceOf(BadRequestException.class);

        verify(lostObjectRepository, never()).close(any(), any(), anyBoolean());
    }

    @Test
    void close_nonexistent_throwsNotFound() {
        when(lostObjectRepository.getByUuid("missing")).thenReturn(null);

        assertThatThrownBy(() -> service.closeLostObject("u1@test.com", "missing", true))
                .isInstanceOf(NotFoundException.class);

        verify(lostObjectRepository, never()).close(any(), any(), anyBoolean());
    }

    // ---- helpers ----

    private FoundObject foundObjectAt(GeoCoordinates coordinates) {
        return FoundObject.builder()
                .uuid("fo-1")
                .title("Objeto encontrado")
                .textEmbedding(List.of(0.1f, 0.2f, 0.3f))
                .coordinates(coordinates)
                .foundDate(LocalDateTime.now())
                .organizationId("1")
                .build();
    }

    private LostObject savedSearch(String username, String description, Float certainty, GeoCoordinates coordinates) {
        return LostObject.builder()
                .uuid(UUID.randomUUID().toString())
                .username(username)
                .description(description)
                .score(certainty)
                .coordinates(coordinates)
                .lostDate(LocalDateTime.now().minusDays(1))
                .build();
    }

    private UserEurekapp user(String username, Role role) {
        return UserEurekapp.builder()
                .id(1L).username(username).firstName("Nombre").lastName("Apellido").role(role)
                .build();
    }
}
