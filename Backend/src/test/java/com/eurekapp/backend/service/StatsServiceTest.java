package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.response.StatsResponseDto;
import com.eurekapp.backend.model.FoundObject;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.FoundObjectRepository;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.IUserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StatsServiceTest {

    @Mock FoundObjectRepository foundObjectRepository;
    @Mock IOrganizationRepository organizationRepository;
    @Mock IUserRepository userRepository;

    @InjectMocks StatsService statsService;

    private UserEurekapp buildUser(Role role) {
        return UserEurekapp.builder()
                .role(role)
                .username("user_" + role.name())
                .password("password")
                .firstName("Test")
                .lastName("User")
                .active(true)
                .XP(0L)
                .returnedObjects(0L)
                .build();
    }

    @Test
    void getStats_returnsCorrectUserCountsByRole() {
        when(userRepository.findAll()).thenReturn(List.of(
                buildUser(Role.USER),
                buildUser(Role.ORGANIZATION_OWNER),
                buildUser(Role.ORGANIZATION_EMPLOYEE)
        ));
        when(organizationRepository.findAll()).thenReturn(List.of(new Organization(), new Organization()));
        when(foundObjectRepository.query(null, null, null, null, true)).thenReturn(List.of());
        when(foundObjectRepository.query(null, null, null, null, false)).thenReturn(List.of());

        StatsResponseDto result = statsService.getStats();

        assertThat(result.getUsers()).isEqualTo(3L);
        assertThat(result.getOrgOwnerUsers()).isEqualTo(1L);
        assertThat(result.getOrgEmployeeUsers()).isEqualTo(1L);
        assertThat(result.getRegularUsers()).isEqualTo(1L);
        assertThat(result.getOrganizations()).isEqualTo(2L);
    }

    @Test
    void getStats_returnsCorrectFoundObjectCounts() {
        when(userRepository.findAll()).thenReturn(List.of());
        when(organizationRepository.findAll()).thenReturn(List.of());
        when(foundObjectRepository.query(null, null, null, null, true)).thenReturn(List.of(
                FoundObject.builder().uuid("a").wasReturned(true).build(),
                FoundObject.builder().uuid("b").wasReturned(true).build()
        ));
        when(foundObjectRepository.query(null, null, null, null, false)).thenReturn(List.of(
                FoundObject.builder().uuid("c").wasReturned(false).build()
        ));

        StatsResponseDto result = statsService.getStats();

        assertThat(result.getReturnedFoundObjects()).isEqualTo(2L);
        assertThat(result.getFoundObjects()).isEqualTo(3L);
    }

    @Test
    void getStats_multipleUsersWithSameRole_countsAll() {
        when(userRepository.findAll()).thenReturn(List.of(
                buildUser(Role.USER),
                buildUser(Role.USER),
                buildUser(Role.USER)
        ));
        when(organizationRepository.findAll()).thenReturn(List.of());
        when(foundObjectRepository.query(null, null, null, null, true)).thenReturn(List.of());
        when(foundObjectRepository.query(null, null, null, null, false)).thenReturn(List.of());

        StatsResponseDto result = statsService.getStats();

        assertThat(result.getRegularUsers()).isEqualTo(3L);
        assertThat(result.getOrgOwnerUsers()).isEqualTo(0L);
        assertThat(result.getOrgEmployeeUsers()).isEqualTo(0L);
    }

    @Test
    void getStats_emptyDatabase_returnsAllZeros() {
        when(userRepository.findAll()).thenReturn(List.of());
        when(organizationRepository.findAll()).thenReturn(List.of());
        when(foundObjectRepository.query(null, null, null, null, true)).thenReturn(List.of());
        when(foundObjectRepository.query(null, null, null, null, false)).thenReturn(List.of());

        StatsResponseDto result = statsService.getStats();

        assertThat(result.getUsers()).isEqualTo(0L);
        assertThat(result.getOrganizations()).isEqualTo(0L);
        assertThat(result.getFoundObjects()).isEqualTo(0L);
        assertThat(result.getReturnedFoundObjects()).isEqualTo(0L);
        assertThat(result.getOrgOwnerUsers()).isEqualTo(0L);
        assertThat(result.getOrgEmployeeUsers()).isEqualTo(0L);
        assertThat(result.getRegularUsers()).isEqualTo(0L);
    }
}
