package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.request.OrganizationRegistrationRequestDto;
import com.eurekapp.backend.dto.request.ResolveOrganizationRequestDto;
import com.eurekapp.backend.dto.response.OrganizationListResponseDto;
import com.eurekapp.backend.dto.response.OrganizationRegistrationResponseDto;
import com.eurekapp.backend.dto.response.OrganizationRequestDetailDto;
import com.eurekapp.backend.dto.response.OrganizationRequestSummaryDto;
import com.eurekapp.backend.dto.response.OrganizationPolicyDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.ForbiddenException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.OrganizationPolicy;
import com.eurekapp.backend.model.OrganizationPolicyHistory;
import com.eurekapp.backend.model.OrganizationRequest;
import com.eurekapp.backend.model.OrganizationRequestStatus;
import com.eurekapp.backend.model.OrganizationType;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IOrganizationPolicyHistoryRepository;
import com.eurekapp.backend.repository.IOrganizationPolicyRepository;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.IOrganizationRequestRepository;
import com.eurekapp.backend.repository.IUserRepository;
import com.eurekapp.backend.service.notification.NotificationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrganizationServiceTest {

    @Mock IOrganizationRepository organizationRepository;
    @Mock IOrganizationRequestRepository requestRepository;
    @Mock IOrganizationPolicyRepository policyRepository;
    @Mock IOrganizationPolicyHistoryRepository historyRepository;
    @Spy ObjectMapper objectMapper = new ObjectMapper();
    @Mock IUserRepository userRepository;
    @Mock NotificationService notificationService;
    @Mock InAppNotificationService inAppNotificationService;
    @Mock EmailTemplateService emailTemplateService;
    @Mock TransactionTemplate transactionTemplate;

    @InjectMocks OrganizationService service;

    @BeforeEach
    void prepararDobles() {
        // La transacción real no interesa acá: se ejecuta el callback tal cual. Es "lenient"
        // porque antes de que el servicio use la plantilla nadie la invoca.
        lenient().when(transactionTemplate.execute(any())).thenAnswer(inv ->
                ((TransactionCallback<?>) inv.getArgument(0)).doInTransaction(null));
        lenient().when(emailTemplateService.buildOrgOwnerApprovedEmail(any(), any())).thenReturn("cuerpo-owner");
        lenient().when(emailTemplateService.buildOrgOwnerInvitedEmail(any(), any(), any())).thenReturn("cuerpo-invitacion");
        lenient().when(emailTemplateService.buildOrgRequestResolvedEmail(any(), any(), anyBoolean(), any()))
                .thenReturn("cuerpo-resolucion");
    }

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

    private OrganizationRequest pendingRequest(UserEurekapp requester) {
        return OrganizationRequest.builder()
                .id(7L)
                .requestingUser(requester)
                .organizationName("Club Atlético")
                .organizationType(OrganizationType.CLUB)
                .street("Calle")
                .streetNumber("123")
                .city("Córdoba")
                .province("Córdoba")
                .country("Argentina")
                .ownerFirstName("Dueño")
                .ownerLastName("Nuevo")
                .ownerEmail("owner@mail.com")
                .ownerPhone("351")
                .reason("motivo")
                .status(OrganizationRequestStatus.PENDING_APPROVAL)
                .build();
    }

    private ResolveOrganizationRequestDto dto(OrganizationRequestStatus resolution, String note) {
        return ResolveOrganizationRequestDto.builder().resolution(resolution).adminNote(note).build();
    }

    // ── resolveOrganizationRequest ────────────────────────────────────────────

    @Test
    void aprobar_conResponsableExistente_creaOrganizacion_promueveYNotifica() {
        UserEurekapp admin = user(Role.ADMIN, "admin");
        UserEurekapp requester = user(Role.USER, "solicitante@mail.com");
        UserEurekapp owner = user(Role.USER, "owner@mail.com");
        OrganizationRequest request = pendingRequest(requester);
        when(requestRepository.findById(7L)).thenReturn(Optional.of(request));
        when(userRepository.findByUsername("owner@mail.com")).thenReturn(Optional.of(owner));

        service.resolveOrganizationRequest(admin, 7L, dto(OrganizationRequestStatus.APPROVED, "ok"));

        ArgumentCaptor<Organization> orgCaptor = ArgumentCaptor.forClass(Organization.class);
        verify(organizationRepository).save(orgCaptor.capture());
        assertThat(orgCaptor.getValue().getName()).isEqualTo("Club Atlético");
        assertThat(orgCaptor.getValue().getContactData()).isEqualTo("owner@mail.com");
        assertThat(owner.getRole()).isEqualTo(Role.ORGANIZATION_OWNER);
        assertThat(owner.getOrganization()).isSameAs(orgCaptor.getValue());
        verify(userRepository).save(owner);
        assertThat(request.getStatus()).isEqualTo(OrganizationRequestStatus.APPROVED);
        assertThat(request.getResolvedBy()).isSameAs(admin);
        assertThat(request.getResolvedAt()).isNotNull();
        assertThat(request.getOrganization()).isSameAs(orgCaptor.getValue());
        verify(requestRepository).save(request);
        verify(inAppNotificationService).createNotification(eq(owner), anyString(), anyString(),
                eq("ROLE_CHANGED"), isNull());
        verify(inAppNotificationService).createNotification(eq(requester), eq("Tu solicitud fue aprobada"),
                anyString(), eq("ORG_REQUEST_APPROVED"), isNull());
        verify(notificationService).sendNotification(eq("owner@mail.com"),
                eq("EurekApp — Sos el responsable de una organización"), eq("cuerpo-owner"));
        verify(notificationService).sendNotification(eq("solicitante@mail.com"),
                eq("EurekApp — Resolución de tu solicitud de organización"), eq("cuerpo-resolucion"));
    }

    @Test
    void aprobar_conResponsableSinCuenta_invitaPorMailYNoPromueveANadie() {
        UserEurekapp admin = user(Role.ADMIN, "admin");
        UserEurekapp requester = user(Role.USER, "solicitante@mail.com");
        OrganizationRequest request = pendingRequest(requester);
        when(requestRepository.findById(7L)).thenReturn(Optional.of(request));
        when(userRepository.findByUsername("owner@mail.com")).thenReturn(Optional.empty());

        service.resolveOrganizationRequest(admin, 7L, dto(OrganizationRequestStatus.APPROVED, null));

        verify(organizationRepository).save(any(Organization.class));
        verify(userRepository, never()).save(any());
        verify(inAppNotificationService, never()).createNotification(any(), any(), any(), eq("ROLE_CHANGED"), any());
        verify(inAppNotificationService).createNotification(eq(requester), eq("Tu solicitud fue aprobada"),
                anyString(), eq("ORG_REQUEST_APPROVED"), isNull());
        verify(notificationService).sendNotification(eq("owner@mail.com"),
                eq("EurekApp — Sos el responsable de una organización"), eq("cuerpo-invitacion"));
        verify(notificationService).sendNotification(eq("solicitante@mail.com"),
                eq("EurekApp — Resolución de tu solicitud de organización"), eq("cuerpo-resolucion"));
        assertThat(request.getStatus()).isEqualTo(OrganizationRequestStatus.APPROVED);
    }

    @Test
    void rechazar_conMotivo_noCreaOrganizacionYNotificaAlSolicitante() {
        UserEurekapp admin = user(Role.ADMIN, "admin");
        UserEurekapp requester = user(Role.USER, "solicitante@mail.com");
        OrganizationRequest request = pendingRequest(requester);
        when(requestRepository.findById(7L)).thenReturn(Optional.of(request));

        service.resolveOrganizationRequest(admin, 7L, dto(OrganizationRequestStatus.REJECTED, "datos dudosos"));

        verify(organizationRepository, never()).save(any());
        verify(userRepository, never()).save(any());
        assertThat(request.getStatus()).isEqualTo(OrganizationRequestStatus.REJECTED);
        assertThat(request.getAdminNote()).isEqualTo("datos dudosos");
        verify(requestRepository).save(request);
        verify(inAppNotificationService).createNotification(eq(requester), eq("Tu solicitud fue rechazada"),
                contains("Nota: datos dudosos"), eq("ORG_REQUEST_REJECTED"), isNull());
        verify(notificationService).sendNotification(eq("solicitante@mail.com"),
                eq("EurekApp — Resolución de tu solicitud de organización"), eq("cuerpo-resolucion"));
    }

    @Test
    void rechazar_sinMotivo_lanzaBadRequestYNoEscribeNada() {
        UserEurekapp admin = user(Role.ADMIN, "admin");
        when(requestRepository.findById(7L)).thenReturn(Optional.of(pendingRequest(user(Role.USER, "s@mail.com"))));

        assertThatThrownBy(() -> service.resolveOrganizationRequest(admin, 7L,
                dto(OrganizationRequestStatus.REJECTED, "  ")))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Debés ingresar un motivo al rechazar una solicitud.");

        verify(requestRepository, never()).save(any());
        verify(inAppNotificationService, never()).createNotification(any(), any(), any(), any(), any());
        verify(notificationService, never()).sendNotification(any(), any(), any());
    }

    @Test
    void solicitudYaResuelta_lanzaBadRequest() {
        UserEurekapp admin = user(Role.ADMIN, "admin");
        OrganizationRequest request = pendingRequest(user(Role.USER, "s@mail.com"));
        request.setStatus(OrganizationRequestStatus.APPROVED);
        when(requestRepository.findById(7L)).thenReturn(Optional.of(request));

        assertThatThrownBy(() -> service.resolveOrganizationRequest(admin, 7L,
                dto(OrganizationRequestStatus.APPROVED, null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("La solicitud ya fue procesada.");

        verify(organizationRepository, never()).save(any());
        verify(requestRepository, never()).save(any());
    }

    @Test
    void solicitudInexistente_lanzaNotFound() {
        UserEurekapp admin = user(Role.ADMIN, "admin");
        when(requestRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.resolveOrganizationRequest(admin, 99L,
                dto(OrganizationRequestStatus.APPROVED, null)))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Solicitud no encontrada.");
    }

    @Test
    void usuarioNoAdministrador_lanzaForbiddenSinTocarNada() {
        UserEurekapp comun = user(Role.USER, "comun@mail.com");

        assertThatThrownBy(() -> service.resolveOrganizationRequest(comun, 7L,
                dto(OrganizationRequestStatus.APPROVED, null)))
                .isInstanceOf(ForbiddenException.class);

        verify(requestRepository, never()).findById(anyLong());
        verify(organizationRepository, never()).save(any());
    }

    @Test
    void mailQueFalla_noRompeLaOperacionNiDeshaceLoGuardado() {
        UserEurekapp admin = user(Role.ADMIN, "admin");
        UserEurekapp requester = user(Role.USER, "solicitante@mail.com");
        UserEurekapp owner = user(Role.USER, "owner@mail.com");
        OrganizationRequest request = pendingRequest(requester);
        when(requestRepository.findById(7L)).thenReturn(Optional.of(request));
        when(userRepository.findByUsername("owner@mail.com")).thenReturn(Optional.of(owner));
        doThrow(new RuntimeException("smtp caído")).when(notificationService).sendNotification(any(), any(), any());

        service.resolveOrganizationRequest(admin, 7L, dto(OrganizationRequestStatus.APPROVED, null));

        // Se intentaron los dos mails pese a que el primero falló.
        verify(notificationService, times(2)).sendNotification(any(), any(), any());
        verify(requestRepository).save(request);
        assertThat(request.getStatus()).isEqualTo(OrganizationRequestStatus.APPROVED);
        assertThat(owner.getRole()).isEqualTo(Role.ORGANIZATION_OWNER);
    }

    @Test
    void plantillaDeMailQueFalla_noDeshaceLaAprobacionYSigueConElOtroMail() {
        UserEurekapp admin = user(Role.ADMIN, "admin");
        UserEurekapp requester = user(Role.USER, "solicitante@mail.com");
        UserEurekapp owner = user(Role.USER, "owner@mail.com");
        OrganizationRequest request = pendingRequest(requester);
        when(requestRepository.findById(7L)).thenReturn(Optional.of(request));
        when(userRepository.findByUsername("owner@mail.com")).thenReturn(Optional.of(owner));
        when(emailTemplateService.buildOrgOwnerApprovedEmail(any(), any()))
                .thenThrow(new RuntimeException("plantilla rota"));

        service.resolveOrganizationRequest(admin, 7L, dto(OrganizationRequestStatus.APPROVED, null));

        // Antes de la transacción esto solo dejaba una advertencia: debe seguir igual.
        assertThat(request.getStatus()).isEqualTo(OrganizationRequestStatus.APPROVED);
        assertThat(owner.getRole()).isEqualTo(Role.ORGANIZATION_OWNER);
        verify(notificationService, times(1)).sendNotification(any(), any(), any());
    }

    // ── updatePolicy ──────────────────────────────────────────────────────────

    private OrganizationPolicyDto policyDto() {
        return OrganizationPolicyDto.builder()
                .maxStorageDays(30)
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
        when(historyRepository.findByOrganizationIdOrderByChangedAtDesc(5L)).thenReturn(List.of());

        service.updatePolicy(owner, policyDto());

        ArgumentCaptor<OrganizationPolicyHistory> hist = ArgumentCaptor.forClass(OrganizationPolicyHistory.class);
        verify(historyRepository).save(hist.capture());
        assertThat(hist.getValue().getOrganizationId()).isEqualTo(5L);
        assertThat(hist.getValue().getChangedBy()).isSameAs(owner);
        assertThat(hist.getValue().getPreviousSnapshot()).contains("\"maxStorageDays\":10");
        verify(policyRepository).save(previa);
        assertThat(previa.getMaxStorageDays()).isEqualTo(30);
    }

    @Test
    void updatePolicy_usuarioQueNoEsResponsable_lanzaForbidden() {
        UserEurekapp empleado = user(Role.ORGANIZATION_EMPLOYEE, "emp@mail.com");

        assertThatThrownBy(() -> service.updatePolicy(empleado, policyDto()))
                .isInstanceOf(ForbiddenException.class);

        verify(policyRepository, never()).save(any());
        verify(historyRepository, never()).save(any());
    }

    // ── Alta de organización ──────────────────────────────────────────────────

    private OrganizationRegistrationRequestDto altaDto() {
        return OrganizationRegistrationRequestDto.builder()
                .organizationName("Club Atlético")
                .organizationType(OrganizationType.CLUB)
                .street("Calle").streetNumber("123").city("Córdoba")
                .province("Córdoba").country("Argentina")
                .latitude(-31.4).longitude(-64.2)
                .ownerFirstName("Dueño").ownerLastName("Nuevo")
                .ownerEmail("owner@mail.com").ownerPhone("351")
                .reason("motivo")
                .build();
    }

    @Test
    void alta_valida_guardaSolicitudPendienteAvisaAlSolicitanteYATodosLosAdmins() {
        UserEurekapp solicitante = user(Role.USER, "solicitante@mail.com");
        UserEurekapp admin1 = user(Role.ADMIN, "admin1@mail.com");
        UserEurekapp admin2 = user(Role.ADMIN, "admin2@mail.com");
        when(requestRepository.findByRequestingUserAndStatus(solicitante, OrganizationRequestStatus.PENDING_APPROVAL))
                .thenReturn(List.of());
        when(userRepository.findByUsernameAndRole("owner@mail.com", Role.ORGANIZATION_OWNER))
                .thenReturn(Optional.empty());
        when(userRepository.findAllByRole(Role.ADMIN)).thenReturn(List.of(admin1, admin2));
        when(emailTemplateService.buildOrgRequestSubmittedEmail(any(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any(), any(), any(), any())).thenReturn("cuerpo-recibida");
        when(emailTemplateService.buildOrgRequestNewEmail(any(), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn("cuerpo-nueva");

        OrganizationRegistrationResponseDto respuesta = service.signUpOrganization(solicitante, altaDto());

        ArgumentCaptor<OrganizationRequest> captor = ArgumentCaptor.forClass(OrganizationRequest.class);
        verify(requestRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(OrganizationRequestStatus.PENDING_APPROVAL);
        assertThat(captor.getValue().getRequestingUser()).isSameAs(solicitante);
        assertThat(captor.getValue().getOrganizationName()).isEqualTo("Club Atlético");
        assertThat(captor.getValue().getCoordinates().getLatitude()).isEqualTo(-31.4);
        assertThat(respuesta.getMessage()).isEqualTo(
                "Tu solicitud fue enviada correctamente. Un administrador la revisará a la brevedad.");
        verify(notificationService).sendNotification("solicitante@mail.com",
                "EurekApp — Solicitud de organización recibida", "cuerpo-recibida");
        verify(inAppNotificationService).createNotification(eq(admin1), eq("Nueva solicitud de organización"),
                contains("Club Atlético"), eq("ORG_REGISTRATION_REQUEST"), any());
        verify(inAppNotificationService).createNotification(eq(admin2), eq("Nueva solicitud de organización"),
                contains("Club Atlético"), eq("ORG_REGISTRATION_REQUEST"), any());
        verify(notificationService).sendNotification("admin1@mail.com",
                "EurekApp — Nueva solicitud de registro de organización", "cuerpo-nueva");
        verify(notificationService).sendNotification("admin2@mail.com",
                "EurekApp — Nueva solicitud de registro de organización", "cuerpo-nueva");
    }

    @Test
    void alta_unAdministradorNoPuedeSolicitar_lanzaForbiddenSinGuardar() {
        UserEurekapp admin = user(Role.ADMIN, "admin");

        assertThatThrownBy(() -> service.signUpOrganization(admin, altaDto()))
                .isInstanceOf(ForbiddenException.class);

        verify(requestRepository, never()).save(any());
    }

    @Test
    void alta_conSolicitudPendiente_lanzaBadRequest() {
        UserEurekapp solicitante = user(Role.USER, "solicitante@mail.com");
        when(requestRepository.findByRequestingUserAndStatus(solicitante, OrganizationRequestStatus.PENDING_APPROVAL))
                .thenReturn(List.of(pendingRequest(solicitante)));

        assertThatThrownBy(() -> service.signUpOrganization(solicitante, altaDto()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("pendiente");

        verify(requestRepository, never()).save(any());
    }

    @Test
    void alta_fueraDeCordobaOArgentina_lanzaBadRequest() {
        UserEurekapp solicitante = user(Role.USER, "solicitante@mail.com");
        when(requestRepository.findByRequestingUserAndStatus(any(), any())).thenReturn(List.of());
        OrganizationRegistrationRequestDto otraProvincia = altaDto();
        otraProvincia.setProvince("Mendoza");
        OrganizationRegistrationRequestDto otroPais = altaDto();
        otroPais.setCountry("Chile");

        assertThatThrownBy(() -> service.signUpOrganization(solicitante, otraProvincia))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("Córdoba");
        assertThatThrownBy(() -> service.signUpOrganization(solicitante, otroPais))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("Argentina");

        verify(requestRepository, never()).save(any());
    }

    @Test
    void alta_tipoOtroSinEspecificar_lanzaBadRequest() {
        UserEurekapp solicitante = user(Role.USER, "solicitante@mail.com");
        when(requestRepository.findByRequestingUserAndStatus(any(), any())).thenReturn(List.of());
        OrganizationRegistrationRequestDto dto = altaDto();
        dto.setOrganizationType(OrganizationType.OTHER);
        dto.setCustomOrganizationType(" ");

        assertThatThrownBy(() -> service.signUpOrganization(solicitante, dto))
                .isInstanceOf(BadRequestException.class);

        verify(requestRepository, never()).save(any());
    }

    @Test
    void alta_conCorreoDeResponsableYaUsado_lanzaBadRequest() {
        UserEurekapp solicitante = user(Role.USER, "solicitante@mail.com");
        when(requestRepository.findByRequestingUserAndStatus(any(), any())).thenReturn(List.of());
        when(userRepository.findByUsernameAndRole("owner@mail.com", Role.ORGANIZATION_OWNER))
                .thenReturn(Optional.of(user(Role.ORGANIZATION_OWNER, "owner@mail.com")));

        assertThatThrownBy(() -> service.signUpOrganization(solicitante, altaDto()))
                .isInstanceOf(BadRequestException.class);

        verify(requestRepository, never()).save(any());
    }

    @Test
    void alta_siFallaElMailDeConfirmacion_laSolicitudQuedaGuardadaYSeAvisaALosAdmins() {
        UserEurekapp solicitante = user(Role.USER, "solicitante@mail.com");
        UserEurekapp admin = user(Role.ADMIN, "admin1@mail.com");
        when(requestRepository.findByRequestingUserAndStatus(any(), any())).thenReturn(List.of());
        when(userRepository.findByUsernameAndRole(any(), any())).thenReturn(Optional.empty());
        when(userRepository.findAllByRole(Role.ADMIN)).thenReturn(List.of(admin));
        when(emailTemplateService.buildOrgRequestSubmittedEmail(any(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any(), any(), any(), any())).thenThrow(new RuntimeException("plantilla rota"));
        when(emailTemplateService.buildOrgRequestNewEmail(any(), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn("cuerpo-nueva");

        service.signUpOrganization(solicitante, altaDto());

        verify(requestRepository).save(any(OrganizationRequest.class));
        verify(inAppNotificationService).createNotification(eq(admin), anyString(), anyString(),
                eq("ORG_REGISTRATION_REQUEST"), any());
    }

    // ── Solicitudes: usuario ──────────────────────────────────────────────────

    @Test
    void misSolicitudes_devuelveLasDelUsuarioConSuDetalle() {
        UserEurekapp solicitante = user(Role.USER, "solicitante@mail.com");
        when(requestRepository.findByRequestingUserOrderByCreatedAtDesc(solicitante))
                .thenReturn(List.of(pendingRequest(solicitante)));

        List<OrganizationRequestDetailDto> resultado = service.getMyOrganizationRequests(solicitante);

        assertThat(resultado).hasSize(1);
        assertThat(resultado.get(0).getOrganizationName()).isEqualTo("Club Atlético");
        assertThat(resultado.get(0).getStatus()).isEqualTo("PENDING_APPROVAL");
        assertThat(resultado.get(0).getRequestingUserEmail()).isEqualTo("solicitante@mail.com");
        assertThat(resultado.get(0).getResolvedByEmail()).isNull();
    }

    @Test
    void cancelar_laPropiaSolicitudPendiente_laMarcaComoCancelada() {
        UserEurekapp solicitante = user(Role.USER, "solicitante@mail.com");
        solicitante.setId(1L);
        OrganizationRequest request = pendingRequest(solicitante);
        when(requestRepository.findById(7L)).thenReturn(Optional.of(request));

        service.cancelOrganizationRequest(solicitante, 7L);

        assertThat(request.getStatus()).isEqualTo(OrganizationRequestStatus.CANCELLED);
        verify(requestRepository).save(request);
    }

    @Test
    void cancelar_solicitudAjena_lanzaForbidden() {
        UserEurekapp solicitante = user(Role.USER, "solicitante@mail.com");
        solicitante.setId(1L);
        UserEurekapp otro = user(Role.USER, "otro@mail.com");
        otro.setId(2L);
        when(requestRepository.findById(7L)).thenReturn(Optional.of(pendingRequest(solicitante)));

        assertThatThrownBy(() -> service.cancelOrganizationRequest(otro, 7L))
                .isInstanceOf(ForbiddenException.class);

        verify(requestRepository, never()).save(any());
    }

    @Test
    void cancelar_solicitudYaResuelta_lanzaBadRequest() {
        UserEurekapp solicitante = user(Role.USER, "solicitante@mail.com");
        solicitante.setId(1L);
        OrganizationRequest request = pendingRequest(solicitante);
        request.setStatus(OrganizationRequestStatus.APPROVED);
        when(requestRepository.findById(7L)).thenReturn(Optional.of(request));

        assertThatThrownBy(() -> service.cancelOrganizationRequest(solicitante, 7L))
                .isInstanceOf(BadRequestException.class);

        verify(requestRepository, never()).save(any());
    }

    @Test
    void cancelar_solicitudInexistente_lanzaNotFound() {
        UserEurekapp solicitante = user(Role.USER, "solicitante@mail.com");
        when(requestRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.cancelOrganizationRequest(solicitante, 99L))
                .isInstanceOf(NotFoundException.class);
    }

    // ── Solicitudes: administrador ────────────────────────────────────────────

    @Test
    void conteoDePendientes_paraAdmin_cuentaLasPendientes() {
        when(requestRepository.countByStatus(OrganizationRequestStatus.PENDING_APPROVAL)).thenReturn(4L);

        assertThat(service.getPendingRequestsCount(user(Role.ADMIN, "admin"))).isEqualTo(4L);
    }

    @Test
    void conteoDePendientes_paraNoAdmin_lanzaForbidden() {
        assertThatThrownBy(() -> service.getPendingRequestsCount(user(Role.USER, "u")))
                .isInstanceOf(ForbiddenException.class);

        verify(requestRepository, never()).countByStatus(any());
    }

    @Test
    void listadoDeSolicitudes_paraAdmin_resumeCadaSolicitud() {
        UserEurekapp solicitante = user(Role.USER, "solicitante@mail.com");
        when(requestRepository.findAll()).thenReturn(List.of(pendingRequest(solicitante)));

        List<OrganizationRequestSummaryDto> resultado = service.getOrganizationRequests(user(Role.ADMIN, "admin"));

        assertThat(resultado).hasSize(1);
        assertThat(resultado.get(0).getOrganizationName()).isEqualTo("Club Atlético");
        assertThat(resultado.get(0).getOrganizationType()).isEqualTo("CLUB");
        assertThat(resultado.get(0).getOwnerEmail()).isEqualTo("owner@mail.com");
        assertThat(resultado.get(0).getRequestingUserEmail()).isEqualTo("solicitante@mail.com");
    }

    @Test
    void listadoDeSolicitudes_paraNoAdmin_lanzaForbidden() {
        assertThatThrownBy(() -> service.getOrganizationRequests(user(Role.USER, "u")))
                .isInstanceOf(ForbiddenException.class);

        verify(requestRepository, never()).findAll();
    }

    @Test
    void detalleDeSolicitud_paraAdmin_devuelveTodosLosDatos() {
        UserEurekapp solicitante = user(Role.USER, "solicitante@mail.com");
        when(requestRepository.findById(7L)).thenReturn(Optional.of(pendingRequest(solicitante)));

        OrganizationRequestDetailDto detalle = service.getOrganizationRequestDetail(user(Role.ADMIN, "admin"), 7L);

        assertThat(detalle.getId()).isEqualTo(7L);
        assertThat(detalle.getReason()).isEqualTo("motivo");
        assertThat(detalle.getRequestingUserFirstName()).isEqualTo("Nombre");
        assertThat(detalle.getLatitude()).isNull();
    }

    @Test
    void detalleDeSolicitud_paraNoAdmin_lanzaForbidden() {
        assertThatThrownBy(() -> service.getOrganizationRequestDetail(user(Role.USER, "u"), 7L))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void detalleDeSolicitud_inexistente_lanzaNotFound() {
        when(requestRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getOrganizationRequestDetail(user(Role.ADMIN, "admin"), 99L))
                .isInstanceOf(NotFoundException.class);
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
        when(historyRepository.findByOrganizationIdOrderByChangedAtDesc(5L)).thenReturn(List.of());

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
        when(historyRepository.findByOrganizationIdOrderByChangedAtDesc(5L)).thenReturn(List.of());

        OrganizationPolicyDto resultado = service.getPolicy(owner);

        assertThat(resultado.getMaxStorageDays()).isEqualTo(15);
        assertThat(resultado.getOrganizationType()).isEqualTo("CLUB");
    }

    @Test
    void getPolicy_usuarioQueNoEsResponsable_lanzaForbidden() {
        assertThatThrownBy(() -> service.getPolicy(user(Role.USER, "u")))
                .isInstanceOf(ForbiddenException.class);
    }
}
