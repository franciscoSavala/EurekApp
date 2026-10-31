package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.response.AdminStatsDto;
import com.eurekapp.backend.exception.ForbiddenException;
import com.eurekapp.backend.model.FoundObject;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.OrganizationRequest;
import com.eurekapp.backend.model.OrganizationRequestStatus;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.FoundObjectRepository;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.IOrganizationRequestRepository;
import com.eurekapp.backend.repository.IUserRepository;
import com.eurekapp.backend.service.notification.NotificationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
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
    @Mock InAppNotificationService inAppNotificationService;
    @Mock NotificationService notificationService;
    @Mock EmailTemplateService emailTemplateService;

    @InjectMocks AdminService adminService;

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

    private Organization buildOrganization(boolean active) {
        Organization organization = new Organization();
        organization.setActive(active);
        return organization;
    }

    private OrganizationRequest buildRequest(OrganizationRequestStatus status) {
        OrganizationRequest request = new OrganizationRequest();
        request.setStatus(status);
        return request;
    }

    @Test
    void getAdminStats_returnsAllTotals() {
        when(userRepository.findAll()).thenReturn(List.of(
                buildUser(Role.USER, true),
                buildUser(Role.USER, false),
                buildUser(Role.ORGANIZATION_OWNER, true),
                buildUser(Role.ORGANIZATION_EMPLOYEE, true),
                buildUser(Role.ORGANIZATION_EMPLOYEE, false),
                buildUser(Role.ENCARGADO, true),
                buildUser(Role.ADMIN, true)
        ));
        when(organizationRepository.findAll()).thenReturn(List.of(
                buildOrganization(true), buildOrganization(true), buildOrganization(false)
        ));
        when(foundObjectRepository.query(null, null, null, null, null, true, null)).thenReturn(List.of(
                FoundObject.builder().uuid("a").wasReturned(true).build(),
                FoundObject.builder().uuid("b").wasReturned(true).build()
        ));
        when(foundObjectRepository.query(null, null, null, null, null, false, null)).thenReturn(List.of(
                FoundObject.builder().uuid("c").wasReturned(false).build()
        ));
        when(organizationRequestRepository.findAll()).thenReturn(List.of(
                buildRequest(OrganizationRequestStatus.PENDING_APPROVAL),
                buildRequest(OrganizationRequestStatus.PENDING_APPROVAL),
                buildRequest(OrganizationRequestStatus.APPROVED),
                buildRequest(OrganizationRequestStatus.REJECTED),
                buildRequest(OrganizationRequestStatus.REJECTED),
                buildRequest(OrganizationRequestStatus.REJECTED)
        ));

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
}
