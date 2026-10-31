package com.eurekapp.backend.integration;

import com.eurekapp.backend.BackendApplication;
import com.eurekapp.backend.dto.response.AdminStatsDto;
import com.eurekapp.backend.dto.response.StatsResponseDto;
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
import com.eurekapp.backend.service.AdminService;
import com.eurekapp.backend.service.StatsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Compara los conteos de las estadisticas contra el resultado de filtrar en memoria los datos reales
 * de MySQL (DATABASE_URL). No asume numeros fijos y no modifica datos.
 */
@SpringBootTest(classes = BackendApplication.class)
class PlatformCountsIntegrationTest {

    @Autowired StatsService statsService;
    @Autowired AdminService adminService;
    @Autowired IUserRepository userRepository;
    @Autowired IOrganizationRepository organizationRepository;
    @Autowired IOrganizationRequestRepository organizationRequestRepository;

    @MockBean FoundObjectRepository foundObjectRepository;

    @BeforeEach
    void stubFoundObjects() {
        when(foundObjectRepository.query(null, null, null, null, null, true, null)).thenReturn(List.of(
                FoundObject.builder().uuid("a").wasReturned(true).build(),
                FoundObject.builder().uuid("b").wasReturned(true).build()
        ));
        when(foundObjectRepository.query(null, null, null, null, null, false, null)).thenReturn(List.of(
                FoundObject.builder().uuid("c").wasReturned(false).build(),
                FoundObject.builder().uuid("d").wasReturned(false).build(),
                FoundObject.builder().uuid("e").wasReturned(false).build()
        ));
    }

    private long usersWithRole(List<UserEurekapp> users, Role role) {
        return users.stream().filter(u -> u.getRole() == role).count();
    }

    private long requestsWithStatus(List<OrganizationRequest> requests, OrganizationRequestStatus status) {
        return requests.stream().filter(r -> r.getStatus() == status).count();
    }

    @Test
    void getStats_matchesInMemoryCountsOfRealData() {
        List<UserEurekapp> users = userRepository.findAll();
        List<Organization> organizations = organizationRepository.findAll();

        StatsResponseDto result = statsService.getStats();

        assertThat(result.getUsers()).isEqualTo(users.size());
        assertThat(result.getOrgOwnerUsers()).isEqualTo(usersWithRole(users, Role.ORGANIZATION_OWNER));
        assertThat(result.getOrgEmployeeUsers()).isEqualTo(usersWithRole(users, Role.ORGANIZATION_EMPLOYEE));
        assertThat(result.getRegularUsers()).isEqualTo(usersWithRole(users, Role.USER));
        assertThat(result.getOrganizations()).isEqualTo(organizations.size());
        assertThat(result.getReturnedFoundObjects()).isEqualTo(2L);
        assertThat(result.getFoundObjects()).isEqualTo(5L);
    }

    @Test
    void getAdminStats_matchesInMemoryCountsOfRealData() {
        List<UserEurekapp> users = userRepository.findAll();
        List<Organization> organizations = organizationRepository.findAll();
        List<OrganizationRequest> requests = organizationRequestRepository.findAll();
        UserEurekapp admin = UserEurekapp.builder().role(Role.ADMIN).username("admin").build();

        AdminStatsDto result = adminService.getAdminStats(admin);

        assertThat(result.getTotalUsers()).isEqualTo(users.size());
        assertThat(result.getActiveUsers()).isEqualTo(users.stream().filter(UserEurekapp::isActive).count());
        assertThat(result.getUserUsers()).isEqualTo(usersWithRole(users, Role.USER));
        assertThat(result.getOrgOwnerUsers()).isEqualTo(usersWithRole(users, Role.ORGANIZATION_OWNER));
        assertThat(result.getOrgEmployeeUsers()).isEqualTo(usersWithRole(users, Role.ORGANIZATION_EMPLOYEE));
        assertThat(result.getEncargadoUsers()).isEqualTo(usersWithRole(users, Role.ENCARGADO));
        assertThat(result.getAdminUsers()).isEqualTo(usersWithRole(users, Role.ADMIN));
        assertThat(result.getTotalOrgs()).isEqualTo(organizations.size());
        assertThat(result.getActiveOrgs()).isEqualTo(organizations.stream().filter(Organization::isActive).count());
        assertThat(result.getReturnedFoundObjects()).isEqualTo(2L);
        assertThat(result.getTotalFoundObjects()).isEqualTo(5L);
        assertThat(result.getOrgRequestsPending())
                .isEqualTo(requestsWithStatus(requests, OrganizationRequestStatus.PENDING_APPROVAL));
        assertThat(result.getOrgRequestsApproved())
                .isEqualTo(requestsWithStatus(requests, OrganizationRequestStatus.APPROVED));
        assertThat(result.getOrgRequestsRejected())
                .isEqualTo(requestsWithStatus(requests, OrganizationRequestStatus.REJECTED));
    }
}
