package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.response.FraudAlertDto;
import com.eurekapp.backend.model.FraudAlert;
import com.eurekapp.backend.model.FraudAlertStatus;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.FoundObjectRepository;
import com.eurekapp.backend.repository.IFraudAlertRepository;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.IReclamoRepository;
import com.eurekapp.backend.repository.ISearchFeedbackRepository;
import com.eurekapp.backend.repository.IUserRepository;
import com.eurekapp.backend.service.notification.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Tests del refactor de FraudAlert (EU-282): una alerta puede señalar a varias personas a la
 * vez y llevar DNI + empleado que entregó. Se valida el mapeo entidad → DTO de ese nuevo shape.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FraudDetectionServiceTest {

    @Mock IFraudAlertRepository alertRepository;
    @Mock ISearchFeedbackRepository feedbackRepository;
    @Mock NotificationService notificationService;
    @Mock IOrganizationRepository organizationRepository;
    @Mock IUserRepository userRepository;
    @Mock InAppNotificationService inAppNotificationService;
    @Mock IReclamoRepository reclamoRepository;
    @Mock FoundObjectRepository foundObjectRepository;
    @Mock EmailTemplateService emailTemplateService;

    FraudDetectionService service;

    @BeforeEach
    void setUp() {
        service = new FraudDetectionService(
                alertRepository, feedbackRepository, notificationService,
                organizationRepository, userRepository, inAppNotificationService,
                reclamoRepository, foundObjectRepository, emailTemplateService);
    }

    private UserEurekapp user(long id, String email, String first, String last) {
        return UserEurekapp.builder()
                .id(id).username(email).firstName(first).lastName(last)
                .role(Role.USER).build();
    }

    private UserEurekapp owner(Organization org) {
        return UserEurekapp.builder()
                .id(100L).username("owner@test.com").firstName("Own").lastName("Er")
                .role(Role.ORGANIZATION_OWNER).organization(org).build();
    }

    @Test
    void getAlerts_maps_dni_suspectUsers_and_employee() {
        Organization org = Organization.builder().id(1L).name("Org").build();
        UserEurekapp suspect = user(7L, "suspect@test.com", "Sus", "Pect");
        UserEurekapp employee = user(5L, "emp@test.com", "Emp", "Loyee");

        FraudAlert alert = FraudAlert.builder()
                .id(1L)
                .organizationId("1")
                .dni("12345678")
                .suspectUsers(new LinkedHashSet<>(Set.of(suspect)))
                .returnedByEmployee(employee)
                .reason("CASE_1")
                .details("detalle")
                .status(FraudAlertStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .build();

        when(alertRepository.findByOrganizationIdOrderByCreatedAtDesc("1"))
                .thenReturn(List.of(alert));

        List<FraudAlertDto> dtos = service.getAlerts(owner(org));

        assertThat(dtos).hasSize(1);
        FraudAlertDto dto = dtos.get(0);
        assertThat(dto.getDni()).isEqualTo("12345678");
        assertThat(dto.getSuspectUsers()).hasSize(1);
        assertThat(dto.getSuspectUsers().get(0).getEmail()).isEqualTo("suspect@test.com");
        assertThat(dto.getSuspectUsers().get(0).getFullName()).isEqualTo("Sus Pect");
        assertThat(dto.getReturnedByEmployeeEmail()).isEqualTo("emp@test.com");
        assertThat(dto.getReturnedByEmployeeFullName()).isEqualTo("Emp Loyee");
    }

    @Test
    void getAlerts_supports_multiple_suspect_users() {
        Organization org = Organization.builder().id(1L).name("Org").build();
        UserEurekapp finder = user(7L, "finder@test.com", "Fin", "Der");
        UserEurekapp retriever = user(8L, "retriever@test.com", "Re", "Triever");

        // Orden estable para poder afirmar sobre la lista resultante.
        Set<UserEurekapp> suspects = new LinkedHashSet<>();
        suspects.add(finder);
        suspects.add(retriever);

        FraudAlert alert = FraudAlert.builder()
                .id(2L)
                .organizationId("1")
                .dni("30111222")
                .suspectUsers(suspects)
                .reason("CASE_2")
                .status(FraudAlertStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .build();

        when(alertRepository.findByOrganizationIdOrderByCreatedAtDesc("1"))
                .thenReturn(List.of(alert));

        List<FraudAlertDto> dtos = service.getAlerts(owner(org));

        assertThat(dtos).hasSize(1);
        assertThat(dtos.get(0).getSuspectUsers())
                .extracting("email")
                .containsExactlyInAnyOrder("finder@test.com", "retriever@test.com");
        // Sin empleado que entrega: los campos quedan nulos, no rompen el mapeo.
        assertThat(dtos.get(0).getReturnedByEmployeeEmail()).isNull();
    }
}
