package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.response.AdminStatsDto;
import com.eurekapp.backend.exception.ForbiddenException;
import com.eurekapp.backend.model.FoundObject;
import com.eurekapp.backend.model.OrganizationRequestStatus;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.FoundObjectRepository;
import com.eurekapp.backend.model.FraudAlertStatus;
import com.eurekapp.backend.model.LostObject;
import com.eurekapp.backend.repository.IFraudAlertRepository;
import com.eurekapp.backend.repository.LostObjectRepository;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.IOrganizationRequestRepository;
import com.eurekapp.backend.repository.IUserRepository;
import com.eurekapp.backend.service.notification.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminServiceTest {

    @Mock IUserRepository userRepository;
    @Mock IOrganizationRepository organizationRepository;
    @Mock IOrganizationRequestRepository organizationRequestRepository;
    @Mock FoundObjectRepository foundObjectRepository;
    @Mock LostObjectRepository lostObjectRepository;
    @Mock IFraudAlertRepository fraudAlertRepository;
    @Mock InAppNotificationService inAppNotificationService;
    @Mock NotificationService notificationService;
    @Mock EmailTemplateService emailTemplateService;

    AdminService adminService;

    @BeforeEach
    void setUp() {
        adminService = new AdminService(userRepository, organizationRepository, organizationRequestRepository,
                inAppNotificationService, notificationService, emailTemplateService,
                new PlatformCountsService(foundObjectRepository, organizationRepository, userRepository, lostObjectRepository),
                fraudAlertRepository);
    }

    private UserEurekapp buildUser(Role role, boolean active) {
        return UserEurekapp.builder()
                .role(role)
                .username("user_" + role.name())
                .password("password")
                .firstName("Test")
                .lastName("User")
                .active(active)
                .XP(0L)
                .returnedObjects(0L)
                .build();
    }

    @Test
    void getAdminStats_returnsAllTotals() {
        when(userRepository.count()).thenReturn(7L);
        when(userRepository.countByActiveTrue()).thenReturn(5L);
        when(userRepository.countByRole(Role.USER)).thenReturn(2L);
        when(userRepository.countByRole(Role.ORGANIZATION_OWNER)).thenReturn(1L);
        when(userRepository.countByRole(Role.ORGANIZATION_EMPLOYEE)).thenReturn(2L);
        when(userRepository.countByRole(Role.ENCARGADO)).thenReturn(1L);
        when(userRepository.countByRole(Role.ADMIN)).thenReturn(1L);
        when(organizationRepository.count()).thenReturn(3L);
        when(organizationRepository.countByActiveTrue()).thenReturn(2L);
        when(foundObjectRepository.query(null, null, null, null, null, true, null)).thenReturn(List.of(
                FoundObject.builder().uuid("a").wasReturned(true).build(),
                FoundObject.builder().uuid("b").wasReturned(true).build()
        ));
        when(foundObjectRepository.query(null, null, null, null, null, false, null)).thenReturn(List.of(
                FoundObject.builder().uuid("c").wasReturned(false).build()
        ));
        when(lostObjectRepository.query(null, null, null, null, null)).thenReturn(List.of(
                LostObject.builder().uuid("l1").build(), LostObject.builder().uuid("l2").build()));
        when(fraudAlertRepository.countByStatus(FraudAlertStatus.ACTIVE)).thenReturn(4L);
        when(organizationRequestRepository.countByStatus(OrganizationRequestStatus.PENDING_APPROVAL)).thenReturn(2L);
        when(organizationRequestRepository.countByStatus(OrganizationRequestStatus.APPROVED)).thenReturn(1L);
        when(organizationRequestRepository.countByStatus(OrganizationRequestStatus.REJECTED)).thenReturn(3L);
        AdminStatsDto result = adminService.getAdminStats(buildUser(Role.ADMIN, true));

        assertThat(result.getTotalUsers()).isEqualTo(7L);
        assertThat(result.getActiveUsers()).isEqualTo(5L);
        assertThat(result.getUserUsers()).isEqualTo(2L);
        assertThat(result.getOrgOwnerUsers()).isEqualTo(1L);
        assertThat(result.getOrgEmployeeUsers()).isEqualTo(2L);
        assertThat(result.getEncargadoUsers()).isEqualTo(1L);
        assertThat(result.getAdminUsers()).isEqualTo(1L);
        assertThat(result.getTotalOrgs()).isEqualTo(3L);
        assertThat(result.getActiveOrgs()).isEqualTo(2L);
        assertThat(result.getReturnedFoundObjects()).isEqualTo(2L);
        assertThat(result.getTotalFoundObjects()).isEqualTo(3L);
        assertThat(result.getTotalLostObjects()).isEqualTo(2L);
        assertThat(result.getPendingFraudAlerts()).isEqualTo(4L);
        assertThat(result.getOrgRequestsPending()).isEqualTo(2L);
        assertThat(result.getOrgRequestsApproved()).isEqualTo(1L);
        assertThat(result.getOrgRequestsRejected()).isEqualTo(3L);
    }

    @Test
    void getAdminStats_nonAdmin_throwsForbidden() {
        UserEurekapp owner = buildUser(Role.ORGANIZATION_OWNER, true);

        assertThatThrownBy(() -> adminService.getAdminStats(owner))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void toggleUserActive_recordsWhoAndWhen() {
        UserEurekapp admin = buildUser(Role.ADMIN, true);
        admin.setId(1L);
        UserEurekapp target = buildUser(Role.USER, true);
        target.setId(2L);
        when(userRepository.findById(2L)).thenReturn(java.util.Optional.of(target));

        adminService.toggleUserActive(admin, 2L, false);

        assertThat(target.isActive()).isFalse();
        assertThat(target.getStatusChangedBy()).isEqualTo(admin.getUsername());
        assertThat(target.getStatusChangedAt()).isNotNull();
    }

    @Test
    void getOrganizationMembers_listsMembersOfOrg() {
        com.eurekapp.backend.model.Organization org = new com.eurekapp.backend.model.Organization();
        UserEurekapp member = buildUser(Role.ORGANIZATION_EMPLOYEE, true);
        when(organizationRepository.findById(5L)).thenReturn(java.util.Optional.of(org));
        when(userRepository.findByOrganizationAndRoleIn(org,
                List.of(Role.ORGANIZATION_OWNER, Role.ORGANIZATION_EMPLOYEE, Role.ENCARGADO)))
                .thenReturn(List.of(member));

        var result = adminService.getOrganizationMembers(buildUser(Role.ADMIN, true), 5L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getRole()).isEqualTo("ORGANIZATION_EMPLOYEE");
    }

    @Test
    void getOrganizationMembers_nonAdmin_throwsForbidden() {
        UserEurekapp owner = buildUser(Role.ORGANIZATION_OWNER, true);

        assertThatThrownBy(() -> adminService.getOrganizationMembers(owner, 5L))
                .isInstanceOf(ForbiddenException.class);
    }
}
