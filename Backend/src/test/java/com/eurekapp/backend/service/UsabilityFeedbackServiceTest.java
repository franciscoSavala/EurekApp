package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.request.SubmitUsabilityFeedbackRequestDto;
import com.eurekapp.backend.dto.response.UsabilityFeedbackRecordDto;
import com.eurekapp.backend.dto.response.UsabilityFeedbackReportDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UsabilityFeedback;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IUsabilityFeedbackRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/* EU-367: el reporte de opiniones sobre la aplicacion paso del responsable de organizacion al
 * administrador de EurekApp, y dejo de recortarse por la organizacion de quien respondio. */
@ExtendWith(MockitoExtension.class)
class UsabilityFeedbackServiceTest {

    @Mock
    IUsabilityFeedbackRepository repository;

    UsabilityFeedbackService service;

    private static final LocalDate FROM = LocalDate.of(2026, 5, 1);
    private static final LocalDate TO = LocalDate.of(2026, 5, 31);

    @BeforeEach
    void setUp() {
        service = new UsabilityFeedbackService(repository);
    }

    private UserEurekapp admin() {
        return UserEurekapp.builder().id(1L).role(Role.ADMIN).build();
    }

    private UserEurekapp organizationOwner() {
        return UserEurekapp.builder()
                .id(2L)
                .role(Role.ORGANIZATION_OWNER)
                .organization(Organization.builder().id(7L).build())
                .build();
    }

    private UserEurekapp endUser() {
        return UserEurekapp.builder().id(3L).role(Role.USER).build();
    }

    private UsabilityFeedback feedback(int stars, String aspects, String comment, String context,
                                       UserEurekapp author, LocalDateTime at) {
        return UsabilityFeedback.builder()
                .id(100L + stars)
                .starRating(stars)
                .aspects(aspects)
                .comment(comment)
                .context(context)
                .createdAt(at)
                .user(author)
                .build();
    }

    // -- Quien puede ver el reporte -------------------------------------------

    // El responsable de organizacion ya no accede al reporte de la aplicacion.
    @Test
    void getReport_rechazaAlResponsableDeOrganizacion() {
        assertThatThrownBy(() -> service.getReport(organizationOwner(), FROM, TO, "DAY"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("administrador");
        verifyNoInteractions(repository);
    }

    // Tampoco el usuario final, que es quien responde pero no quien lee.
    @Test
    void getReport_rechazaAlUsuarioFinal() {
        assertThatThrownBy(() -> service.getReport(endUser(), FROM, TO, "DAY"))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(repository);
    }

    // Los registros individuales siguen la misma regla que el agregado.
    @Test
    void getRecords_rechazaAlResponsableDeOrganizacion() {
        assertThatThrownBy(() -> service.getRecords(organizationOwner(), FROM, TO))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(repository);
    }

    // Y la exportacion tambien: eran tres puertas, no una.
    @Test
    void exportCsv_rechazaAlResponsableDeOrganizacion() {
        assertThatThrownBy(() -> service.exportCsv(organizationOwner(), FROM, TO))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(repository);
    }

    // -- El recorte por organizacion desaparecio ------------------------------

    /* El bug de fondo: el reporte pedia las respuestas de la organizacion del autor, y el usuario
     * final no tiene ninguna, asi que sus respuestas se guardaban y no se veian en ningun lado.
     * Ahora se piden por rango de fechas y nada mas. */
    @Test
    void getReport_pideTodasLasRespuestasDelRangoSinFiltrarPorOrganizacion() {
        UserEurekapp sinOrganizacion = endUser();
        when(repository.findByCreatedAtBetween(any(), any())).thenReturn(List.of(
                feedback(5, "FACILIDAD_USO", "Muy clara", "profile", sinOrganizacion, LocalDateTime.of(2026, 5, 2, 10, 0)),
                feedback(3, "NAVEGACION", null, "close_search", sinOrganizacion, LocalDateTime.of(2026, 5, 3, 10, 0))
        ));

        UsabilityFeedbackReportDto report = service.getReport(admin(), FROM, TO, "DAY");

        assertThat(report.getTotalFeedback()).isEqualTo(2L);
        verify(repository).findByCreatedAtBetween(
                FROM.atStartOfDay(), TO.plusDays(1).atStartOfDay());
        verifyNoMoreInteractions(repository);
    }

    // El rango incluye el dia "hasta" completo, no lo corta a la medianoche de su comienzo.
    @Test
    void getRecords_incluyeElDiaFinalCompleto() {
        when(repository.findByCreatedAtBetween(any(), any())).thenReturn(List.of());

        service.getRecords(admin(), FROM, TO);

        ArgumentCaptor<LocalDateTime> desde = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> hasta = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(repository).findByCreatedAtBetween(desde.capture(), hasta.capture());
        assertThat(desde.getValue()).isEqualTo(LocalDateTime.of(2026, 5, 1, 0, 0));
        assertThat(hasta.getValue()).isEqualTo(LocalDateTime.of(2026, 6, 1, 0, 0));
    }

    // -- Lo que el administrador ve -------------------------------------------

    @Test
    void getReport_calculaPromedioDistribucionYAspectos() {
        UserEurekapp autor = endUser();
        when(repository.findByCreatedAtBetween(any(), any())).thenReturn(List.of(
                feedback(5, "FACILIDAD_USO,CLARIDAD", null, "profile", autor, LocalDateTime.of(2026, 5, 2, 10, 0)),
                feedback(4, "CLARIDAD", null, "close_search", autor, LocalDateTime.of(2026, 5, 2, 12, 0)),
                feedback(3, null, null, "profile", autor, LocalDateTime.of(2026, 5, 4, 9, 0))
        ));

        UsabilityFeedbackReportDto report = service.getReport(admin(), FROM, TO, "DAY");

        assertThat(report.getAverageRating()).isEqualTo(4.0);
        assertThat(report.getTotalFeedback()).isEqualTo(3L);
        assertThat(report.getStarDistribution())
                .containsEntry(5, 1L).containsEntry(4, 1L).containsEntry(3, 1L)
                .containsEntry(2, 0L).containsEntry(1, 0L);
        assertThat(report.getAspectDistribution())
                .containsEntry("FACILIDAD_USO", 1L).containsEntry("CLARIDAD", 2L);
        // Dos dias con respuestas -> dos puntos en la serie temporal.
        assertThat(report.getTimeSeries()).hasSize(2);
    }

    // Sin respuestas en el rango, el reporte se muestra vacio en lugar de romperse.
    @Test
    void getReport_sinRespuestasDevuelveReporteVacio() {
        when(repository.findByCreatedAtBetween(any(), any())).thenReturn(List.of());

        UsabilityFeedbackReportDto report = service.getReport(admin(), FROM, TO, "DAY");

        assertThat(report.getAverageRating()).isEqualTo(0.0);
        assertThat(report.getTotalFeedback()).isZero();
        assertThat(report.getTimeSeries()).isEmpty();
    }

    // Los registros no exponen quien respondio: solo puntaje, aspectos, comentario y contexto.
    @Test
    void getRecords_devuelveRegistrosSinDatosPersonales() {
        when(repository.findByCreatedAtBetween(any(), any())).thenReturn(List.of(
                feedback(2, "NAVEGACION,CLARIDAD", "Me perdi en el menu", "close_search",
                        endUser(), LocalDateTime.of(2026, 5, 6, 8, 0))
        ));

        List<UsabilityFeedbackRecordDto> records = service.getRecords(admin(), FROM, TO);

        assertThat(records).hasSize(1);
        UsabilityFeedbackRecordDto r = records.get(0);
        assertThat(r.getStarRating()).isEqualTo(2);
        assertThat(r.getAspects()).containsExactly("NAVEGACION", "CLARIDAD");
        assertThat(r.getComment()).isEqualTo("Me perdi en el menu");
        assertThat(r.getContext()).isEqualTo("close_search");
    }

    @Test
    void exportCsv_admin_exportaLasRespuestasDelRango() {
        when(repository.findByCreatedAtBetween(any(), any())).thenReturn(List.of(
                feedback(4, "CLARIDAD", "Comentario; con punto y coma", "profile",
                        endUser(), LocalDateTime.of(2026, 5, 7, 8, 0))
        ));

        String csv = new String(service.exportCsv(admin(), FROM, TO), StandardCharsets.UTF_8);

        assertThat(csv).contains("starRating;aspects;comment;context;createdAt");
        assertThat(csv).contains("\"Comentario; con punto y coma\"");
        assertThat(csv).contains("profile");
    }

    // -- Registrar una respuesta ----------------------------------------------

    // El contexto viaja tal cual: es lo que despues permite distinguir de que momento vino.
    @Test
    void submit_guardaLaRespuestaConSuContexto() {
        SubmitUsabilityFeedbackRequestDto dto = new SubmitUsabilityFeedbackRequestDto();
        dto.setStarRating(5);
        dto.setAspects(List.of("FACILIDAD_USO", "CLARIDAD"));
        dto.setComment("Todo bien");
        dto.setContext("close_search");
        UserEurekapp autor = endUser();

        service.submit(autor, dto);

        ArgumentCaptor<UsabilityFeedback> guardado = ArgumentCaptor.forClass(UsabilityFeedback.class);
        verify(repository).save(guardado.capture());
        UsabilityFeedback fb = guardado.getValue();
        assertThat(fb.getStarRating()).isEqualTo(5);
        assertThat(fb.getAspects()).isEqualTo("FACILIDAD_USO,CLARIDAD");
        assertThat(fb.getContext()).isEqualTo("close_search");
        assertThat(fb.getUser()).isSameAs(autor);
        assertThat(fb.getCreatedAt()).isNotNull();
    }

    // Un usuario final puede responder aunque no pertenezca a ninguna organizacion.
    @Test
    void submit_aceptaAUnUsuarioSinOrganizacion() {
        SubmitUsabilityFeedbackRequestDto dto = new SubmitUsabilityFeedbackRequestDto();
        dto.setStarRating(3);
        dto.setContext("profile");

        service.submit(endUser(), dto);

        ArgumentCaptor<UsabilityFeedback> guardado = ArgumentCaptor.forClass(UsabilityFeedback.class);
        verify(repository).save(guardado.capture());
        assertThat(guardado.getValue().getAspects()).isNull();
    }
}
