package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.response.FraudUserReportEntryDto;
import com.eurekapp.backend.exception.ForbiddenException;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.repository.*;
import com.eurekapp.backend.service.notification.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
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

    @InjectMocks FraudDetectionService fraudDetectionService;

    private static final String ORG_ID = "1";
    private static final LocalDate FROM = LocalDate.now().minusDays(30);
    private static final LocalDate TO = LocalDate.now();

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(fraudDetectionService, "finderClaimerCollusionThreshold", 2);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private Organization buildOrg() {
        return Organization.builder().id(1L).name("TestOrg").contactData("org@test.com").build();
    }

    private UserEurekapp buildUser(Long id, String username, Role role) {
        Organization org = (role == Role.USER) ? null : buildOrg();
        return UserEurekapp.builder()
                .id(id).username(username).password("pass")
                .firstName("Test").lastName("User")
                .role(role).organization(org)
                .active(true).XP(0L).returnedObjects(0L)
                .build();
    }

    private FraudAlert buildAlert(Long id, UserEurekapp suspect, FraudAlertStatus status, String uuid) {
        return FraudAlert.builder()
                .id(id).organizationId(ORG_ID).foundObjectUUID(uuid)
                .suspectUser(suspect).reason("FINDER_CLAIMER_COLLUSION").details("details")
                .status(status).createdAt(LocalDateTime.now())
                .build();
    }

    // ─── getFraudUserReport: gravedad y acción sugerida ──────────────────────

    @Test
    void getFraudUserReport_zeroConfirmed_gravityZeroNoAction() {
        UserEurekapp owner = buildUser(1L, "owner@org.com", Role.ORGANIZATION_OWNER);
        UserEurekapp suspect = buildUser(2L, "suspect@mail.com", Role.USER);
        FraudAlert pending = buildAlert(1L, suspect, FraudAlertStatus.PENDING, "uuid-1");

        when(alertRepository.findByOrganizationIdAndCreatedAtBetween(eq(ORG_ID), any(), any()))
                .thenReturn(List.of(pending));
        when(alertRepository.findByOrganizationIdAndSuspectUser_Id(ORG_ID, 2L))
                .thenReturn(List.of(pending));

        List<FraudUserReportEntryDto> report = fraudDetectionService.getFraudUserReport(
                owner, FROM, TO, null, null);

        assertThat(report).hasSize(1);
        assertThat(report.get(0).getGravityLevel()).isEqualTo(0);
        assertThat(report.get(0).getSuggestedAction()).isEqualTo("Sin acción sugerida");
    }

    @Test
    void getFraudUserReport_oneConfirmed_gravityOneAdvertencia() {
        UserEurekapp owner = buildUser(1L, "owner@org.com", Role.ORGANIZATION_OWNER);
        UserEurekapp suspect = buildUser(2L, "suspect@mail.com", Role.USER);
        FraudAlert confirmed = buildAlert(1L, suspect, FraudAlertStatus.CONFIRMED_FRAUD, "uuid-1");

        when(alertRepository.findByOrganizationIdAndCreatedAtBetween(eq(ORG_ID), any(), any()))
                .thenReturn(List.of(confirmed));
        when(alertRepository.findByOrganizationIdAndSuspectUser_Id(ORG_ID, 2L))
                .thenReturn(List.of(confirmed));

        List<FraudUserReportEntryDto> report = fraudDetectionService.getFraudUserReport(
                owner, FROM, TO, null, null);

        assertThat(report.get(0).getGravityLevel()).isEqualTo(1);
        assertThat(report.get(0).getSuggestedAction()).isEqualTo("Advertencia");
    }

    @Test
    void getFraudUserReport_twoConfirmed_gravityTwoSuspension() {
        UserEurekapp owner = buildUser(1L, "owner@org.com", Role.ORGANIZATION_OWNER);
        UserEurekapp suspect = buildUser(2L, "suspect@mail.com", Role.USER);
        List<FraudAlert> alerts = List.of(
                buildAlert(1L, suspect, FraudAlertStatus.CONFIRMED_FRAUD, "uuid-1"),
                buildAlert(2L, suspect, FraudAlertStatus.CONFIRMED_FRAUD, "uuid-2"));

        when(alertRepository.findByOrganizationIdAndCreatedAtBetween(eq(ORG_ID), any(), any()))
                .thenReturn(alerts);
        when(alertRepository.findByOrganizationIdAndSuspectUser_Id(ORG_ID, 2L))
                .thenReturn(alerts);

        List<FraudUserReportEntryDto> report = fraudDetectionService.getFraudUserReport(
                owner, FROM, TO, null, null);

        assertThat(report.get(0).getGravityLevel()).isEqualTo(2);
        assertThat(report.get(0).getSuggestedAction()).isEqualTo("Suspensión temporal");
    }

    @Test
    void getFraudUserReport_threeConfirmed_gravityTwoSuspension() {
        UserEurekapp owner = buildUser(1L, "owner@org.com", Role.ORGANIZATION_OWNER);
        UserEurekapp suspect = buildUser(2L, "suspect@mail.com", Role.USER);
        List<FraudAlert> alerts = List.of(
                buildAlert(1L, suspect, FraudAlertStatus.CONFIRMED_FRAUD, "uuid-1"),
                buildAlert(2L, suspect, FraudAlertStatus.CONFIRMED_FRAUD, "uuid-2"),
                buildAlert(3L, suspect, FraudAlertStatus.CONFIRMED_FRAUD, "uuid-3"));

        when(alertRepository.findByOrganizationIdAndCreatedAtBetween(eq(ORG_ID), any(), any()))
                .thenReturn(alerts);
        when(alertRepository.findByOrganizationIdAndSuspectUser_Id(ORG_ID, 2L))
                .thenReturn(alerts);

        List<FraudUserReportEntryDto> report = fraudDetectionService.getFraudUserReport(
                owner, FROM, TO, null, null);

        assertThat(report.get(0).getGravityLevel()).isEqualTo(2);
        assertThat(report.get(0).getSuggestedAction()).isEqualTo("Suspensión temporal");
    }

    @Test
    void getFraudUserReport_fourConfirmed_gravityThreeBloqueo() {
        UserEurekapp owner = buildUser(1L, "owner@org.com", Role.ORGANIZATION_OWNER);
        UserEurekapp suspect = buildUser(2L, "suspect@mail.com", Role.USER);
        List<FraudAlert> alerts = List.of(
                buildAlert(1L, suspect, FraudAlertStatus.CONFIRMED_FRAUD, "uuid-1"),
                buildAlert(2L, suspect, FraudAlertStatus.CONFIRMED_FRAUD, "uuid-2"),
                buildAlert(3L, suspect, FraudAlertStatus.CONFIRMED_FRAUD, "uuid-3"),
                buildAlert(4L, suspect, FraudAlertStatus.CONFIRMED_FRAUD, "uuid-4"));

        when(alertRepository.findByOrganizationIdAndCreatedAtBetween(eq(ORG_ID), any(), any()))
                .thenReturn(alerts);
        when(alertRepository.findByOrganizationIdAndSuspectUser_Id(ORG_ID, 2L))
                .thenReturn(alerts);

        List<FraudUserReportEntryDto> report = fraudDetectionService.getFraudUserReport(
                owner, FROM, TO, null, null);

        assertThat(report.get(0).getGravityLevel()).isEqualTo(3);
        assertThat(report.get(0).getSuggestedAction()).isEqualTo("Bloqueo");
    }

    @Test
    void getFraudUserReport_countsConfirmedAndPendingSeparately() {
        UserEurekapp owner = buildUser(1L, "owner@org.com", Role.ORGANIZATION_OWNER);
        UserEurekapp suspect = buildUser(2L, "suspect@mail.com", Role.USER);
        List<FraudAlert> alerts = List.of(
                buildAlert(1L, suspect, FraudAlertStatus.CONFIRMED_FRAUD, "uuid-1"),
                buildAlert(2L, suspect, FraudAlertStatus.PENDING, "uuid-2"),
                buildAlert(3L, suspect, FraudAlertStatus.PENDING, "uuid-3"));

        when(alertRepository.findByOrganizationIdAndCreatedAtBetween(eq(ORG_ID), any(), any()))
                .thenReturn(alerts);
        when(alertRepository.findByOrganizationIdAndSuspectUser_Id(ORG_ID, 2L))
                .thenReturn(alerts);

        List<FraudUserReportEntryDto> report = fraudDetectionService.getFraudUserReport(
                owner, FROM, TO, null, null);

        FraudUserReportEntryDto entry = report.get(0);
        assertThat(entry.getFraudCount()).isEqualTo(3);
        assertThat(entry.getConfirmedFraudCount()).isEqualTo(1);
        assertThat(entry.getPendingCount()).isEqualTo(2);
    }

    @Test
    void getFraudUserReport_multipleUsers_sortedByGravityDescending() {
        UserEurekapp owner = buildUser(1L, "owner@org.com", Role.ORGANIZATION_OWNER);
        UserEurekapp lowRisk = buildUser(2L, "low@mail.com", Role.USER);
        UserEurekapp highRisk = buildUser(3L, "high@mail.com", Role.USER);

        FraudAlert lowAlert = buildAlert(1L, lowRisk, FraudAlertStatus.PENDING, "uuid-1");
        List<FraudAlert> highAlerts = List.of(
                buildAlert(2L, highRisk, FraudAlertStatus.CONFIRMED_FRAUD, "uuid-2"),
                buildAlert(3L, highRisk, FraudAlertStatus.CONFIRMED_FRAUD, "uuid-3"),
                buildAlert(4L, highRisk, FraudAlertStatus.CONFIRMED_FRAUD, "uuid-3b"),
                buildAlert(5L, highRisk, FraudAlertStatus.CONFIRMED_FRAUD, "uuid-3c"));

        when(alertRepository.findByOrganizationIdAndCreatedAtBetween(eq(ORG_ID), any(), any()))
                .thenReturn(List.of(lowAlert, highAlerts.get(0), highAlerts.get(1), highAlerts.get(2), highAlerts.get(3)));
        when(alertRepository.findByOrganizationIdAndSuspectUser_Id(ORG_ID, 2L))
                .thenReturn(List.of(lowAlert));
        when(alertRepository.findByOrganizationIdAndSuspectUser_Id(ORG_ID, 3L))
                .thenReturn(highAlerts);

        List<FraudUserReportEntryDto> report = fraudDetectionService.getFraudUserReport(
                owner, FROM, TO, null, null);

        assertThat(report).hasSize(2);
        assertThat(report.get(0).getEmail()).isEqualTo("high@mail.com");
        assertThat(report.get(1).getEmail()).isEqualTo("low@mail.com");
    }

    // ─── getFraudUserReport: control de acceso ────────────────────────────────

    @Test
    void getFraudUserReport_regularUser_throwsForbidden() {
        UserEurekapp user = buildUser(1L, "user@mail.com", Role.USER);

        assertThatThrownBy(() -> fraudDetectionService.getFraudUserReport(user, FROM, TO, null, null))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void getFraudUserReport_orgEmployee_throwsForbidden() {
        UserEurekapp emp = buildUser(1L, "emp@mail.com", Role.ORGANIZATION_EMPLOYEE);

        assertThatThrownBy(() -> fraudDetectionService.getFraudUserReport(emp, FROM, TO, null, null))
                .isInstanceOf(ForbiddenException.class);
    }

    // ─── getAlerts / resolve: control de acceso ───────────────────────────────

    @Test
    void getAlerts_regularUser_throwsForbidden() {
        UserEurekapp user = buildUser(1L, "user@mail.com", Role.USER);

        assertThatThrownBy(() -> fraudDetectionService.getAlerts(user))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void resolve_regularUser_throwsForbidden() {
        UserEurekapp user = buildUser(1L, "user@mail.com", Role.USER);

        assertThatThrownBy(() -> fraudDetectionService.resolve(1L, user, FraudAlertStatus.CONFIRMED_FRAUD))
                .isInstanceOf(ForbiddenException.class);
    }

    // ─── checkForFraud: detección de colusión ────────────────────────────────

    @Test
    void checkForFraud_finderEqualsClaimer_doesNotCreateAlert() {
        UserEurekapp user = buildUser(1L, "user@mail.com", Role.USER);
        FoundObject fo = FoundObject.builder().uuid("uuid-1").objectFinderUser(user).build();

        fraudDetectionService.checkForFraud(ORG_ID, "uuid-1", user, "desc", fo);

        verify(alertRepository, never()).save(any());
    }

    @Test
    void checkForFraud_nullFoundObject_doesNotCreateAlert() {
        UserEurekapp claimer = buildUser(2L, "claimer@mail.com", Role.USER);

        fraudDetectionService.checkForFraud(ORG_ID, "uuid-1", claimer, "desc", null);

        verify(alertRepository, never()).save(any());
    }

    @Test
    void checkForFraud_nullFinderUser_doesNotCreateAlert() {
        UserEurekapp claimer = buildUser(2L, "claimer@mail.com", Role.USER);
        FoundObject fo = FoundObject.builder().uuid("uuid-1").objectFinderUser(null).build();

        fraudDetectionService.checkForFraud(ORG_ID, "uuid-1", claimer, "desc", fo);

        verify(alertRepository, never()).save(any());
    }

    @Test
    void checkForFraud_noPreviousCollusionWithSameFinder_doesNotCreateAlert() {
        UserEurekapp finder = buildUser(1L, "finder@mail.com", Role.USER);
        UserEurekapp claimer = buildUser(2L, "claimer@mail.com", Role.USER);
        FoundObject fo = FoundObject.builder().uuid("uuid-current").objectFinderUser(finder).build();

        when(reclamoRepository.findByUser_Id(2L)).thenReturn(List.of());

        fraudDetectionService.checkForFraud(ORG_ID, "uuid-current", claimer, "desc", fo);

        verify(alertRepository, never()).save(any());
    }

    @Test
    void checkForFraud_atCollusionThreshold_createsAlert() {
        // threshold=2: una colusión previa + la actual = 2 >= threshold → alerta
        UserEurekapp finder = buildUser(1L, "finder@mail.com", Role.USER);
        UserEurekapp claimer = buildUser(2L, "claimer@mail.com", Role.USER);
        FoundObject currentFo = FoundObject.builder().uuid("uuid-current").objectFinderUser(finder).build();
        FoundObject previousFo = FoundObject.builder().uuid("uuid-prev").objectFinderUser(finder).build();

        Reclamo previousReclamo = Reclamo.builder()
                .foundObjectUUID("uuid-prev").organizationId(ORG_ID).user(claimer)
                .status(ClaimStatus.APROBADO).createdAt(LocalDateTime.now())
                .build();

        when(reclamoRepository.findByUser_Id(2L)).thenReturn(List.of(previousReclamo));
        when(foundObjectRepository.getByUuid("uuid-prev")).thenReturn(previousFo);
        when(alertRepository.existsByOrganizationIdAndFoundObjectUUIDAndSuspectUserAndReasonAndStatus(
                anyString(), anyString(), any(), anyString(), any())).thenReturn(false);
        when(organizationRepository.findById(1L)).thenReturn(Optional.empty());

        fraudDetectionService.checkForFraud(ORG_ID, "uuid-current", claimer, "desc", currentFo);

        verify(alertRepository).save(argThat(alert ->
                alert.getReason().equals("FINDER_CLAIMER_COLLUSION") &&
                alert.getSuspectUser().getId().equals(2L)));
    }

    @Test
    void checkForFraud_alertAlreadyExists_doesNotDuplicateAlert() {
        UserEurekapp finder = buildUser(1L, "finder@mail.com", Role.USER);
        UserEurekapp claimer = buildUser(2L, "claimer@mail.com", Role.USER);
        FoundObject currentFo = FoundObject.builder().uuid("uuid-current").objectFinderUser(finder).build();
        FoundObject previousFo = FoundObject.builder().uuid("uuid-prev").objectFinderUser(finder).build();

        Reclamo previousReclamo = Reclamo.builder()
                .foundObjectUUID("uuid-prev").organizationId(ORG_ID).user(claimer)
                .status(ClaimStatus.APROBADO).createdAt(LocalDateTime.now())
                .build();

        when(reclamoRepository.findByUser_Id(2L)).thenReturn(List.of(previousReclamo));
        when(foundObjectRepository.getByUuid("uuid-prev")).thenReturn(previousFo);
        when(alertRepository.existsByOrganizationIdAndFoundObjectUUIDAndSuspectUserAndReasonAndStatus(
                anyString(), anyString(), any(), anyString(), any())).thenReturn(true);

        fraudDetectionService.checkForFraud(ORG_ID, "uuid-current", claimer, "desc", currentFo);

        verify(alertRepository, never()).save(any());
    }
}
