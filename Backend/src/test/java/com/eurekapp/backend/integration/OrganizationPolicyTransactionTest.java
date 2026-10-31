package com.eurekapp.backend.integration;

import com.eurekapp.backend.dto.response.OrganizationPolicyDto;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.OrganizationPolicy;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IOrganizationPolicyHistoryRepository;
import com.eurekapp.backend.repository.IOrganizationPolicyRepository;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.IUserRepository;
import com.eurekapp.backend.service.OrganizationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Si falla el guardado de la política, no puede quedar en el historial un cambio que nunca ocurrió.
 *
 * <p>Va contra la base real y a propósito NO es transaccional: una transacción de test
 * escondería justamente lo que se quiere comprobar.</p>
 */
@SpringBootTest
class OrganizationPolicyTransactionTest {

    @Autowired OrganizationService organizationService;
    @Autowired IUserRepository userRepository;
    @Autowired IOrganizationRepository organizationRepository;
    @Autowired IOrganizationPolicyRepository policyRepository;
    @Autowired IOrganizationPolicyHistoryRepository historyRepository;

    private final String sufijo = UUID.randomUUID().toString().substring(0, 8);
    private Organization organizacion;
    private UserEurekapp responsable;
    private OrganizationPolicy politica;

    @AfterEach
    void limpiar() {
        if (organizacion != null) {
            historyRepository.deleteAll(historyRepository.findByOrganizationIdOrderByChangedAtDesc(organizacion.getId()));
        }
        if (politica != null) {
            policyRepository.deleteById(politica.getId());
        }
        if (responsable != null) {
            userRepository.deleteById(responsable.getId());
        }
        if (organizacion != null) {
            organizationRepository.deleteById(organizacion.getId());
        }
    }

    @Test
    void siFallaElGuardadoDeLaPolitica_noQuedaHistorialNiCambios() {
        organizacion = organizationRepository.save(Organization.builder()
                .name("Org politica " + sufijo)
                .contactData("politica_" + sufijo + "@test.local")
                .build());
        responsable = userRepository.save(UserEurekapp.builder()
                .username("responsable_" + sufijo + "@test.local")
                .password("password")
                .firstName("Test")
                .lastName("Politica")
                .role(Role.ORGANIZATION_OWNER)
                .organization(organizacion)
                .active(true)
                .XP(0L)
                .returnedObjects(0L)
                .build());
        politica = policyRepository.save(OrganizationPolicy.builder()
                .organization(organizacion)
                .maxStorageDays(30)
                .requiresIdentityValidation(false)
                .requiresAdditionalEvidence(false)
                .build());

        // Un tipo inexistente hace fallar el servicio cuando el historial ya se escribió.
        OrganizationPolicyDto dto = OrganizationPolicyDto.builder()
                .maxStorageDays(60)
                .requiresIdentityValidation(true)
                .requiresAdditionalEvidence(true)
                .organizationType("TIPO_INEXISTENTE")
                .build();

        assertThatThrownBy(() -> organizationService.updatePolicy(responsable, dto))
                .isInstanceOf(IllegalArgumentException.class);

        assertThat(historyRepository.findByOrganizationIdOrderByChangedAtDesc(organizacion.getId()).size())
                .as("no debe quedar historial de un cambio que falló")
                .isZero();
        OrganizationPolicy recargada = policyRepository.findById(politica.getId()).orElseThrow();
        assertThat(recargada.getMaxStorageDays()).isEqualTo(30);
    }
}
