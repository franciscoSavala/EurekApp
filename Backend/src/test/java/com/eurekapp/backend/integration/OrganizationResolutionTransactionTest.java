package com.eurekapp.backend.integration;

import com.eurekapp.backend.dto.request.ResolveOrganizationRequestDto;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.OrganizationRequest;
import com.eurekapp.backend.model.OrganizationRequestStatus;
import com.eurekapp.backend.model.OrganizationType;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.IOrganizationRequestRepository;
import com.eurekapp.backend.repository.IUserRepository;
import com.eurekapp.backend.service.InAppNotificationService;
import com.eurekapp.backend.service.OrganizationService;
import com.eurekapp.backend.service.notification.NotificationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * Si un paso de la aprobación de una organización falla, no puede quedar nada a medias:
 * ni la organización creada, ni el responsable promovido, ni la solicitud resuelta.
 *
 * <p>Va contra la base real y a propósito NO es transaccional: una transacción de test
 * escondería justamente lo que se quiere comprobar.</p>
 */
@SpringBootTest
class OrganizationResolutionTransactionTest {

    @Autowired OrganizationService organizationService;
    @Autowired IUserRepository userRepository;
    @Autowired IOrganizationRepository organizationRepository;
    @Autowired IOrganizationRequestRepository requestRepository;

    @MockBean NotificationService notificationService;
    @MockBean InAppNotificationService inAppNotificationService;

    private final String sufijo = UUID.randomUUID().toString().substring(0, 8);
    private UserEurekapp admin;
    private UserEurekapp solicitante;
    private UserEurekapp responsable;
    private OrganizationRequest solicitud;
    private String nombreOrganizacion;

    @AfterEach
    void limpiar() {
        if (solicitud != null && solicitud.getId() != null) {
            requestRepository.deleteById(solicitud.getId());
        }
        organizationRepository.findAll().stream()
                .filter(o -> nombreOrganizacion != null && nombreOrganizacion.equals(o.getName()))
                .forEach(o -> {
                    if (responsable != null && responsable.getId() != null) {
                        userRepository.findById(responsable.getId()).ifPresent(u -> {
                            u.setOrganization(null);
                            userRepository.save(u);
                        });
                    }
                    organizationRepository.delete(o);
                });
        for (UserEurekapp u : new UserEurekapp[]{responsable, solicitante, admin}) {
            if (u != null && u.getId() != null) {
                userRepository.deleteById(u.getId());
            }
        }
    }

    private UserEurekapp crearUsuario(Role role, String prefijo) {
        return userRepository.save(UserEurekapp.builder()
                .username(prefijo + "_" + sufijo + "@test.local")
                .password("password")
                .firstName("Test")
                .lastName("Transaccion")
                .role(role)
                .active(true)
                .XP(0L)
                .returnedObjects(0L)
                .build());
    }

    @Test
    void siFallaUnAvisoInterno_laAprobacionNoDejaNadaAMedias() {
        admin = crearUsuario(Role.ADMIN, "admin");
        solicitante = crearUsuario(Role.USER, "solicitante");
        responsable = crearUsuario(Role.USER, "responsable");
        nombreOrganizacion = "Org transaccion " + sufijo;
        solicitud = requestRepository.save(OrganizationRequest.builder()
                .requestingUser(solicitante)
                .organizationName(nombreOrganizacion)
                .organizationType(OrganizationType.CLUB)
                .street("Calle")
                .streetNumber("1")
                .city("Córdoba")
                .province("Córdoba")
                .country("Argentina")
                .ownerFirstName("Test")
                .ownerLastName("Responsable")
                .ownerEmail(responsable.getUsername())
                .ownerPhone("351")
                .reason("prueba")
                .status(OrganizationRequestStatus.PENDING_APPROVAL)
                .createdAt(LocalDateTime.now())
                .build());

        // El aviso de la aprobación es el último paso de la resolución: falla cuando ya se
        // escribió todo lo demás.
        doThrow(new RuntimeException("falla simulada"))
                .when(inAppNotificationService)
                .createNotification(any(), any(), any(), eq("ORG_REQUEST_APPROVED"), any());

        ResolveOrganizationRequestDto dto = ResolveOrganizationRequestDto.builder()
                .resolution(OrganizationRequestStatus.APPROVED)
                .build();

        assertThatThrownBy(() -> organizationService.resolveOrganizationRequest(admin, solicitud.getId(), dto))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("falla simulada");

        List<Organization> creadas = organizationRepository.findAll().stream()
                .filter(o -> nombreOrganizacion.equals(o.getName()))
                .toList();
        assertThat(creadas).as("la organización no debe existir").isEmpty();

        OrganizationRequest recargada = requestRepository.findById(solicitud.getId()).orElseThrow();
        assertThat(recargada.getStatus()).isEqualTo(OrganizationRequestStatus.PENDING_APPROVAL);
        assertThat(recargada.getOrganization()).isNull();

        UserEurekapp responsableRecargado = userRepository.findById(responsable.getId()).orElseThrow();
        assertThat(responsableRecargado.getRole()).isEqualTo(Role.USER);
        assertThat(responsableRecargado.getOrganization()).isNull();

        verify(notificationService, never()).sendNotification(any(), any(), any());
    }
}
