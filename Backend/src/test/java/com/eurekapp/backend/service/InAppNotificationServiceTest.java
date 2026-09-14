package com.eurekapp.backend.service;

import com.eurekapp.backend.model.InAppNotification;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IInAppNotificationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * EU-398: entrar a "Notificaciones" tiene que dejar constancia de que se vieron.
 *
 * <p>Antes el numerito del menú se apagaba sólo en la pantalla: del lado del servidor las
 * notificaciones seguían sin leer, así que el refresco de los 30 segundos las volvía a contar y el
 * número reaparecía con el mismo valor. Lo único que marcaba algo era tocarlas de a una.</p>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class InAppNotificationServiceTest {

    @Mock IInAppNotificationRepository repository;

    InAppNotificationService service;

    UserEurekapp user;
    UserEurekapp otroUsuario;

    @BeforeEach
    void setUp() {
        service = new InAppNotificationService(repository);
        user = UserEurekapp.builder().id(1L).username("ana@mail.com").role(Role.USER).build();
        otroUsuario = UserEurekapp.builder().id(2L).username("bruno@mail.com").role(Role.USER).build();
    }

    private InAppNotification sinLeer(Long id) {
        return InAppNotification.builder()
                .id(id)
                .user(user)
                .title("Aviso " + id)
                .description("Cuerpo del aviso " + id)
                .type("MATCH_FOUND")
                .read(false)
                .createdAt(LocalDateTime.now())
                .build();
    }

    // ---------- EU-398: entrar a la sección marca todas las pendientes ----------

    @Test
    void entrarALaSeccion_marcaComoLeidasTodasLasPendientes() {
        InAppNotification primera = sinLeer(10L);
        InAppNotification segunda = sinLeer(11L);
        when(repository.findByUserAndReadFalse(user)).thenReturn(List.of(primera, segunda));

        service.markAllAsRead(user);

        assertThat(primera.isRead()).isTrue();
        assertThat(segunda.isRead()).isTrue();
    }

    @Test
    void entrarALaSeccion_guardaLasQueMarco() {
        InAppNotification primera = sinLeer(10L);
        InAppNotification segunda = sinLeer(11L);
        when(repository.findByUserAndReadFalse(user)).thenReturn(List.of(primera, segunda));

        service.markAllAsRead(user);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<InAppNotification>> captor = ArgumentCaptor.forClass(List.class);
        verify(repository).saveAll(captor.capture());
        assertThat(captor.getValue()).containsExactly(primera, segunda);
    }

    /**
     * Las ya leídas no se tocan porque ni siquiera se traen: se pide explícitamente por las que
     * quedaban sin leer. Es lo que evita reescribir toda la tabla del usuario en cada visita.
     */
    @Test
    void entrarALaSeccion_solamentePideLasQueEstabanSinLeer() {
        when(repository.findByUserAndReadFalse(user)).thenReturn(List.of(sinLeer(10L)));

        service.markAllAsRead(user);

        verify(repository).findByUserAndReadFalse(eq(user));
    }

    @Test
    void entrarALaSeccion_marcaLasDelUsuarioQuePide_noLasDeOtro() {
        when(repository.findByUserAndReadFalse(otroUsuario)).thenReturn(List.of());

        service.markAllAsRead(otroUsuario);

        verify(repository).findByUserAndReadFalse(eq(otroUsuario));
        verify(repository, never()).findByUserAndReadFalse(eq(user));
    }

    @Test
    void sinNotificacionesPendientes_noGuardaNada() {
        when(repository.findByUserAndReadFalse(user)).thenReturn(List.of());

        service.markAllAsRead(user);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<InAppNotification>> captor = ArgumentCaptor.forClass(List.class);
        verify(repository).saveAll(captor.capture());
        assertThat(captor.getValue()).isEmpty();
    }

    /**
     * El indicador del menú sale de este conteo: es el que, antes del arreglo, volvía a encender el
     * numerito 30 segundos después de haber entrado a mirar.
     */
    @Test
    void despuesDeEntrar_elIndicadorDelMenuQuedaEnCero() {
        when(repository.findByUserAndReadFalse(user)).thenReturn(List.of(sinLeer(10L), sinLeer(11L)));
        when(repository.countByUserAndReadFalse(user)).thenReturn(2L);
        assertThat(service.getUnreadCount(user)).isEqualTo(2L);

        service.markAllAsRead(user);
        when(repository.countByUserAndReadFalse(user)).thenReturn(0L);

        assertThat(service.getUnreadCount(user)).isZero();
    }
}
