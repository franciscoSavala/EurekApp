package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.response.OrganizationListResponseDto;
import com.eurekapp.backend.dto.response.OrganizationPolicyDto;
import com.eurekapp.backend.exception.ForbiddenException;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.OrganizationPolicy;
import com.eurekapp.backend.model.OrganizationPolicyHistory;
import com.eurekapp.backend.model.OrganizationType;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IOrganizationPolicyHistoryRepository;
import com.eurekapp.backend.repository.IOrganizationPolicyRepository;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrganizationServiceTest {

    @Mock IOrganizationRepository organizationRepository;
    @Mock IOrganizationPolicyRepository policyRepository;
    @Mock IOrganizationPolicyHistoryRepository historyRepository;
    @Spy ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks OrganizationService service;

    private UserEurekapp user(Role role, String username) {
        return UserEurekapp.builder()
                .role(role)
                .username(username)
                .password("password")
                .firstName("Nombre")
                .lastName("Apellido")
                .active(true)
                .XP(0L)
                .returnedObjects(0L)
                .build();
    }

    // ── updatePolicy ──────────────────────────────────────────────────────────

    private OrganizationPolicyDto policyDto() {
        return OrganizationPolicyDto.builder()
                .maxStorageDays(30)
                .maxLostDateDays(45)
                .requiresIdentityValidation(true)
                .requiresAdditionalEvidence(false)
                .additionalEvidenceDetails("detalle")
                .organizationType("CLUB")
                .build();
    }

    private UserEurekapp owner() {
        Organization org = Organization.builder().id(5L).name("Org").build();
        UserEurekapp u = user(Role.ORGANIZATION_OWNER, "owner@mail.com");
        u.setOrganization(org);
        return u;
    }

    @Test
    void updatePolicy_sinPoliticaPrevia_creaLaPoliticaYNoGuardaHistorial() {
        UserEurekapp owner = owner();
        when(organizationRepository.findById(5L)).thenReturn(Optional.of(owner.getOrganization()));
        when(policyRepository.findByOrganization_Id(5L)).thenReturn(Optional.empty());

        service.updatePolicy(owner, policyDto());

        verify(historyRepository, never()).save(any());
        ArgumentCaptor<OrganizationPolicy> captor = ArgumentCaptor.forClass(OrganizationPolicy.class);
        verify(policyRepository).save(captor.capture());
        assertThat(captor.getValue().getMaxStorageDays()).isEqualTo(30);
        assertThat(captor.getValue().getMaxLostDateDays()).isEqualTo(45);
        assertThat(captor.getValue().getOrganizationType()).isEqualTo(OrganizationType.CLUB);
        assertThat(captor.getValue().getOrganization()).isSameAs(owner.getOrganization());
    }

    @Test
    void updatePolicy_conPoliticaPrevia_guardaHistorialYActualizaLaPolitica() {
        UserEurekapp owner = owner();
        OrganizationPolicy previa = OrganizationPolicy.builder()
                .organization(owner.getOrganization())
                .maxStorageDays(10)
                .build();
        when(organizationRepository.findById(5L)).thenReturn(Optional.of(owner.getOrganization()));
        when(policyRepository.findByOrganization_Id(5L)).thenReturn(Optional.of(previa));
        when(historyRepository.findByOrganization_IdOrderByChangedAtDesc(5L)).thenReturn(List.of());

        service.updatePolicy(owner, policyDto());

        ArgumentCaptor<OrganizationPolicyHistory> hist = ArgumentCaptor.forClass(OrganizationPolicyHistory.class);
        verify(historyRepository).save(hist.capture());
        assertThat(hist.getValue().getOrganization().getId()).isEqualTo(5L);
        assertThat(hist.getValue().getChangedBy()).isSameAs(owner);
        assertThat(hist.getValue().getPreviousSnapshot()).contains("\"maxStorageDays\":10");
        verify(policyRepository).save(previa);
        assertThat(previa.getMaxStorageDays()).isEqualTo(30);
    }

    @Test
    void updatePolicy_conPlazoDePerdidaInvalido_seRechazaConBadRequestYNoSeGuardaNada() {
        UserEurekapp owner = owner();
        for (Integer invalido : new Integer[] {null, 0, -5}) {
            OrganizationPolicyDto dto = policyDto();
            dto.setMaxLostDateDays(invalido);
            assertThatThrownBy(() -> service.updatePolicy(owner, dto))
                    .isInstanceOf(com.eurekapp.backend.exception.BadRequestException.class);
        }
        verify(policyRepository, never()).save(any());
    }

    @Test
    void updatePolicy_usuarioQueNoEsResponsable_lanzaForbidden() {
        UserEurekapp empleado = user(Role.ORGANIZATION_EMPLOYEE, "emp@mail.com");

        assertThatThrownBy(() -> service.updatePolicy(empleado, policyDto()))
                .isInstanceOf(ForbiddenException.class);

        verify(policyRepository, never()).save(any());
        verify(historyRepository, never()).save(any());
    }

    // ── Listado público y lectura de política ─────────────────────────────────

    @Test
    void listadoPublico_omiteLasInactivasYNoExponeElContacto() {
        Organization activa = Organization.builder().id(1L).name("Activa").street("Calle").streetNumber("1")
                .city("Córdoba").province("Córdoba").country("Argentina").contactData("privado@mail.com").build();
        Organization inactiva = Organization.builder().id(2L).name("Inactiva").active(false).build();
        when(organizationRepository.findAll()).thenReturn(List.of(activa, inactiva));

        OrganizationListResponseDto resultado = service.getAllOrganizations();

        assertThat(resultado.getOrganizations()).hasSize(1);
        assertThat(resultado.getOrganizations().get(0).getName()).isEqualTo("Activa");
        assertThat(resultado.getOrganizations().get(0).getAddress()).doesNotContain("privado@mail.com");
    }

    @Test
    void getPolicy_sinPoliticaCargada_devuelveSoloElHistorial() {
        UserEurekapp owner = owner();
        when(policyRepository.findByOrganization_Id(5L)).thenReturn(Optional.empty());
        when(historyRepository.findByOrganization_IdOrderByChangedAtDesc(5L)).thenReturn(List.of());

        OrganizationPolicyDto resultado = service.getPolicy(owner);

        assertThat(resultado.getMaxStorageDays()).isNull();
        assertThat(resultado.getHistory()).isEmpty();
    }

    @Test
    void getPolicy_conPolitica_devuelveSusValores() {
        UserEurekapp owner = owner();
        OrganizationPolicy politica = OrganizationPolicy.builder().organization(owner.getOrganization())
                .maxStorageDays(15).organizationType(OrganizationType.CLUB).build();
        when(policyRepository.findByOrganization_Id(5L)).thenReturn(Optional.of(politica));
        when(historyRepository.findByOrganization_IdOrderByChangedAtDesc(5L)).thenReturn(List.of());

        OrganizationPolicyDto resultado = service.getPolicy(owner);

        assertThat(resultado.getMaxStorageDays()).isEqualTo(15);
        assertThat(resultado.getOrganizationType()).isEqualTo("CLUB");
    }

    @Test
    void getPolicy_usuarioQueNoEsResponsable_lanzaForbidden() {
        assertThatThrownBy(() -> service.getPolicy(user(Role.USER, "u")))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void getPolicy_empleadoDeLaOrganizacion_veLasPoliticasSinElHistorial() {
        // EU-440: el empleado necesita ver qué exige la organización al devolver un objeto.
        UserEurekapp empleado = user(Role.ORGANIZATION_EMPLOYEE, "emp@mail.com");
        empleado.setOrganization(Organization.builder().id(5L).name("Org").build());
        OrganizationPolicy politica = OrganizationPolicy.builder().organization(empleado.getOrganization())
                .requiresIdentityValidation(true).requiresAdditionalEvidence(true)
                .additionalEvidenceDetails("foto con el dueño").build();
        when(policyRepository.findByOrganization_Id(5L)).thenReturn(Optional.of(politica));

        OrganizationPolicyDto resultado = service.getPolicy(empleado);

        assertThat(resultado.getRequiresIdentityValidation()).isTrue();
        assertThat(resultado.getAdditionalEvidenceDetails()).isEqualTo("foto con el dueño");
        assertThat(resultado.getHistory()).isEmpty();
        verifyNoInteractions(historyRepository);
    }

    // -- EU-458: el historial de politicas exige una organizacion que exista ---

    @Test
    void updatePolicy_conUnaOrganizacionInexistente_seRechazaYNoSeGuardaNada() {
        UserEurekapp owner = owner();
        when(organizationRepository.findById(5L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updatePolicy(owner, policyDto()))
                .isInstanceOf(com.eurekapp.backend.exception.BadRequestException.class);

        verify(historyRepository, never()).save(any());
        verify(policyRepository, never()).save(any());
    }
}
