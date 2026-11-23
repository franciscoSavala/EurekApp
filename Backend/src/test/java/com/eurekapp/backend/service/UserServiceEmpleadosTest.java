package com.eurekapp.backend.service;

import com.eurekapp.backend.configuration.security.JwtService;
import com.eurekapp.backend.exception.ForbiddenException;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.repository.IAddEmployeeRequestRepository;
import com.eurekapp.backend.repository.IUserRepository;
import com.eurekapp.backend.service.notification.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** Reglas de la gestión de empleados: desvincular, encargados, invitaciones y su aceptación. */
class UserServiceEmpleadosTest {

    private IUserRepository userRepository;
    private IAddEmployeeRequestRepository requestRepository;
    private UserService service;
    private Organization utn;
    private Organization otra;
    private UserEurekapp dueno;

    @BeforeEach
    void setUp() {
        userRepository = mock(IUserRepository.class);
        requestRepository = mock(IAddEmployeeRequestRepository.class);
        service = new UserService(userRepository, requestRepository, mock(NotificationService.class),
                mock(InAppNotificationService.class), mock(EmailTemplateService.class), mock(JwtService.class));
        utn = Organization.builder().id(1L).name("UTN").build();
        otra = Organization.builder().id(2L).name("Terminal").build();
        dueno = UserEurekapp.builder().id(1L).username("owner@utn.com").role(Role.ORGANIZATION_OWNER).organization(utn).build();
    }

    private UserEurekapp usuario(long id, Role rol, Organization org) {
        UserEurekapp u = UserEurekapp.builder().id(id).username("u" + id + "@mail.com").firstName("Ana").lastName("Paz")
                .role(rol).organization(org).build();
        when(userRepository.findById(id)).thenReturn(Optional.of(u));
        return u;
    }

    @Test
    void desvincular_empleadoDeLaOrganizacion_vuelveASerUsuarioSinOrganizacion() {
        UserEurekapp empleado = usuario(5L, Role.ORGANIZATION_EMPLOYEE, utn);

        assertThat(service.removeEmployeeFromOrganization(dueno, 5L)).isTrue();

        assertThat(empleado.getRole()).isEqualTo(Role.USER);
        assertThat(empleado.getOrganization()).isNull();
    }

    @Test
    void desvincular_empleadoDeOtraOrganizacion_noLoModifica() {
        UserEurekapp ajeno = usuario(6L, Role.ORGANIZATION_EMPLOYEE, otra);

        assertThat(service.removeEmployeeFromOrganization(dueno, 6L)).isFalse();

        assertThat(ajeno.getRole()).isEqualTo(Role.ORGANIZATION_EMPLOYEE);
        assertThat(ajeno.getOrganization()).isSameAs(otra);
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    void asignarEncargado_soloSePuedeAUnEmpleadoDeLaMismaOrganizacion() {
        UserEurekapp ajeno = usuario(6L, Role.ORGANIZATION_EMPLOYEE, otra);
        UserEurekapp otroDueno = usuario(7L, Role.ORGANIZATION_OWNER, utn);

        assertThatThrownBy(() -> service.assignEncargado(dueno, 6L)).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.assignEncargado(dueno, 7L)).isInstanceOf(ForbiddenException.class);
        assertThat(ajeno.getRole()).isEqualTo(Role.ORGANIZATION_EMPLOYEE);
        assertThat(otroDueno.getRole()).isEqualTo(Role.ORGANIZATION_OWNER);
    }

    @Test
    void asignarEncargado_aUnEmpleado_loConvierteEnEncargado() {
        UserEurekapp empleado = usuario(5L, Role.ORGANIZATION_EMPLOYEE, utn);

        service.assignEncargado(dueno, 5L);

        assertThat(empleado.getRole()).isEqualTo(Role.ENCARGADO);
    }

    @Test
    void invitar_aQuienYaPerteneceAUnaOrganizacion_seRechaza() {
        UserEurekapp ajeno = UserEurekapp.builder().username("ajeno@mail.com").role(Role.ORGANIZATION_EMPLOYEE).organization(otra).build();
        when(userRepository.existsByUsername("ajeno@mail.com")).thenReturn(true);
        when(userRepository.getByUsername("ajeno@mail.com")).thenReturn(ajeno);

        assertThatThrownBy(() -> service.addEmployeeToOrganization(dueno, "ajeno@mail.com"))
                .isInstanceOf(ForbiddenException.class);
        verify(requestRepository, never()).save(any());
    }

    @Test
    void invitar_conUnaInvitacionPendienteDeLaMismaOrganizacion_seRechaza() {
        UserEurekapp libre = UserEurekapp.builder().username("libre@mail.com").role(Role.USER).build();
        when(userRepository.existsByUsername("libre@mail.com")).thenReturn(true);
        when(userRepository.getByUsername("libre@mail.com")).thenReturn(libre);
        when(requestRepository.findByUserAndOrganizationAndStatus(libre, utn, AddEmployeeRequestStatus.PENDING))
                .thenReturn(List.of(AddEmployeeRequest.builder().id(9L).build()));

        assertThatThrownBy(() -> service.addEmployeeToOrganization(dueno, "libre@mail.com"))
                .isInstanceOf(ForbiddenException.class);
        verify(requestRepository, never()).save(any());
    }

    @Test
    void aceptarInvitacion_loHaceEmpleadoYRechazaLasOtrasPendientes() {
        UserEurekapp invitado = UserEurekapp.builder().id(8L).username("inv@mail.com").firstName("Leo").lastName("Ruiz").role(Role.USER).build();
        AddEmployeeRequest aceptada = AddEmployeeRequest.builder().id(10L).user(invitado).organization(utn)
                .status(AddEmployeeRequestStatus.PENDING).build();
        AddEmployeeRequest otraPendiente = AddEmployeeRequest.builder().id(11L).user(invitado).organization(otra)
                .status(AddEmployeeRequestStatus.PENDING).build();
        when(requestRepository.findById(10L)).thenReturn(Optional.of(aceptada));
        when(requestRepository.findByUserAndStatus(invitado, AddEmployeeRequestStatus.PENDING))
                .thenReturn(new ArrayList<>(List.of(otraPendiente)));

        var sesion = service.acceptAddEmployeeRequest(invitado, 10L);

        // La sesión que vuelve ya refleja el rol y la organización nuevos.
        assertThat(sesion.getUser().getRole()).isEqualTo("ORGANIZATION_EMPLOYEE");
        assertThat(sesion.getOrganization().getName()).isEqualTo("UTN");
        assertThat(invitado.getRole()).isEqualTo(Role.ORGANIZATION_EMPLOYEE);
        assertThat(invitado.getOrganization()).isSameAs(utn);
        assertThat(aceptada.getStatus()).isEqualTo(AddEmployeeRequestStatus.ACCEPTED);
        assertThat(otraPendiente.getStatus()).isEqualTo(AddEmployeeRequestStatus.DECLINED);
    }

    @Test
    void aceptarInvitacion_deOtraPersona_seRechazaSinCambiarNada() {
        UserEurekapp invitado = UserEurekapp.builder().id(8L).username("inv@mail.com").role(Role.USER).build();
        UserEurekapp intruso = UserEurekapp.builder().id(9L).username("intruso@mail.com").role(Role.USER).build();
        AddEmployeeRequest solicitud = AddEmployeeRequest.builder().id(10L).user(invitado).organization(utn)
                .status(AddEmployeeRequestStatus.PENDING).build();
        when(requestRepository.findById(10L)).thenReturn(Optional.of(solicitud));

        assertThatThrownBy(() -> service.acceptAddEmployeeRequest(intruso, 10L)).isInstanceOf(ForbiddenException.class);

        assertThat(intruso.getRole()).isEqualTo(Role.USER);
        assertThat(intruso.getOrganization()).isNull();
        assertThat(solicitud.getStatus()).isEqualTo(AddEmployeeRequestStatus.PENDING);
        verify(userRepository, never()).saveAndFlush(eq(intruso));
    }
}
