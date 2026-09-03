package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.request.SubmitFeedbackRequestDto;
import com.eurekapp.backend.dto.response.FeedbackReportDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.OrganizationFeedback;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.SearchFeedback;
import com.eurekapp.backend.model.UsabilityFeedback;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.FoundObjectRepository;
import com.eurekapp.backend.repository.IOrganizationFeedbackRepository;
import com.eurekapp.backend.repository.ISearchFeedbackRepository;
import com.eurekapp.backend.repository.IUsabilityFeedbackRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/* EU-372 y EU-375, que salen juntas: una corta la fuente vieja del reporte del responsable de
 * organizacion (las estrellas de la pantalla de resultados) y la otra le da la nueva (las
 * calificaciones posteriores a la devolucion). Separadas, el reporte quedaria vacio en el medio. */
@ExtendWith(MockitoExtension.class)
class FeedbackServiceTest {

    @Mock ISearchFeedbackRepository feedbackRepository;
    @Mock FoundObjectRepository foundObjectRepository;
    @Mock IUsabilityFeedbackRepository usabilityFeedbackRepository;
    @Mock IOrganizationFeedbackRepository organizationFeedbackRepository;

    FeedbackService service;

    private static final Long ORG_ID = 3L;
    private static final LocalDate FROM = LocalDate.of(2026, 5, 1);
    private static final LocalDate TO = LocalDate.of(2026, 5, 31);

    @BeforeEach
    void setUp() {
        service = new FeedbackService(feedbackRepository, foundObjectRepository,
                usabilityFeedbackRepository, organizationFeedbackRepository);
    }

    private UserEurekapp responsable() {
        return UserEurekapp.builder()
                .id(2L)
                .role(Role.ORGANIZATION_OWNER)
                .organization(Organization.builder().id(ORG_ID).name("UTN FRC").build())
                .build();
    }

    private UserEurekapp usuarioFinal() {
        return UserEurekapp.builder().id(9L).role(Role.USER).build();
    }

    private SubmitFeedbackRequestDto respuestaDeBusqueda(Integer estrellas, boolean encontro, String comentario) {
        SubmitFeedbackRequestDto dto = new SubmitFeedbackRequestDto();
        dto.setOrganizationId(String.valueOf(ORG_ID));
        dto.setFoundObjectUUID(encontro ? "uuid-objeto" : null);
        dto.setStarRating(estrellas);
        dto.setWasFound(encontro);
        dto.setComment(comentario);
        dto.setLostObjectText("billetera negra");
        return dto;
    }

    private OrganizationFeedback calificacion(int trato, int espera, int claridad, int estado,
                                              int seguridad, String comentario, LocalDateTime cuando) {
        return OrganizationFeedback.builder()
                .organizationId(ORG_ID)
                .staffTreatment(trato)
                .waitingTime(espera)
                .instructionsClarity(claridad)
                .objectCondition(estado)
                .pickupSecurity(seguridad)
                .comment(comentario)
                .createdAt(cuando)
                .build();
    }

    // -- EU-372: lo que se responde en la pantalla de resultados ---------------

    /* A la organizacion le queda el "lo encontraste?", que mide que tan seguido la gente encuentra
     * su objeto ahi. Las estrellas y el comentario no: en ese momento la persona no fue a retirar
     * nada ni trato con nadie. */
    @Test
    void submit_laOrganizacionSoloRegistraSiLaPersonaEncontroSuObjeto() {
        service.submit(usuarioFinal(), respuestaDeBusqueda(4, true, "Muy buena la app"));

        ArgumentCaptor<SearchFeedback> guardado = ArgumentCaptor.forClass(SearchFeedback.class);
        verify(feedbackRepository).save(guardado.capture());
        SearchFeedback fb = guardado.getValue();
        assertThat(fb.getWasFound()).isTrue();
        assertThat(fb.getOrganizationId()).isEqualTo("3");
        assertThat(fb.getStarRating()).isNull();
        assertThat(fb.getComment()).isNull();
    }

    // Las estrellas y el comentario pasan a ser opinion sobre la aplicacion.
    @Test
    void submit_lasEstrellasYElComentarioVanAlReporteDelAdministrador() {
        UserEurekapp autor = usuarioFinal();

        service.submit(autor, respuestaDeBusqueda(4, true, "Muy buena la app"));

        ArgumentCaptor<UsabilityFeedback> guardado = ArgumentCaptor.forClass(UsabilityFeedback.class);
        verify(usabilityFeedbackRepository).save(guardado.capture());
        UsabilityFeedback fb = guardado.getValue();
        assertThat(fb.getStarRating()).isEqualTo(4);
        assertThat(fb.getComment()).isEqualTo("Muy buena la app");
        // El contexto permite distinguir despues de que momento vino la respuesta.
        assertThat(fb.getContext()).isEqualTo("search_results");
        assertThat(fb.getUser()).isSameAs(autor);
    }

    // Sin estrellas no hay opinion que registrar, pero el "no lo encontre" se guarda igual.
    @Test
    void submit_sinEstrellas_registraLaBusquedaYNingunaOpinion() {
        service.submit(usuarioFinal(), respuestaDeBusqueda(0, false, null));

        verify(feedbackRepository).save(any(SearchFeedback.class));
        verify(usabilityFeedbackRepository, never()).save(any());
    }

    // -- EU-375: el reporte del responsable de organizacion --------------------

    @Test
    void getReport_muestraUnPromedioPorAspectoYNoUnoSolo() {
        when(feedbackRepository.findByOrganizationIdAndCreatedAtBetween(any(), any(), any()))
                .thenReturn(List.of());
        when(organizationFeedbackRepository.findByOrganizationIdAndCreatedAtBetween(any(), any(), any()))
                .thenReturn(List.of(
                        calificacion(5, 3, 4, 5, 4, null, LocalDateTime.of(2026, 5, 2, 10, 0)),
                        calificacion(4, 1, 4, 5, 4, null, LocalDateTime.of(2026, 5, 3, 10, 0))
                ));

        FeedbackReportDto report = service.getReport(responsable(), FROM, TO, "DAY", null);

        assertThat(report.getTotalRatings()).isEqualTo(2L);
        assertThat(report.getAspectAverages())
                .containsEntry("staff_treatment", 4.5)
                .containsEntry("waiting_time", 2.0)
                .containsEntry("instructions_clarity", 4.0)
                .containsEntry("object_condition", 5.0)
                .containsEntry("pickup_security", 4.0);
        // El orden es estable: el responsable ve siempre los aspectos en la misma secuencia.
        assertThat(report.getAspectAverages().keySet())
                .containsExactly("staff_treatment", "waiting_time", "instructions_clarity",
                        "object_condition", "pickup_security");
    }

    // Los comentarios libres se muestran, del mas nuevo al mas viejo, y sin los vacios.
    @Test
    void getReport_muestraLosComentariosLibresDelMasNuevoAlMasViejo() {
        when(feedbackRepository.findByOrganizationIdAndCreatedAtBetween(any(), any(), any()))
                .thenReturn(List.of());
        when(organizationFeedbackRepository.findByOrganizationIdAndCreatedAtBetween(any(), any(), any()))
                .thenReturn(List.of(
                        calificacion(5, 5, 5, 5, 5, "Muy amables", LocalDateTime.of(2026, 5, 2, 10, 0)),
                        calificacion(2, 2, 2, 2, 2, "   ", LocalDateTime.of(2026, 5, 3, 10, 0)),
                        calificacion(3, 3, 3, 3, 3, "Espere mucho", LocalDateTime.of(2026, 5, 9, 10, 0))
                ));

        FeedbackReportDto report = service.getReport(responsable(), FROM, TO, "DAY", null);

        assertThat(report.getComments()).hasSize(2);
        assertThat(report.getComments().get(0).getComment()).isEqualTo("Espere mucho");
        assertThat(report.getComments().get(1).getComment()).isEqualTo("Muy amables");
    }

    // Se conserva cuantas busquedas terminaron encontrando el objeto en esa organizacion.
    @Test
    void getReport_conservaElRecuentoDeBusquedasQueTerminaronEncontrandoElObjeto() {
        when(feedbackRepository.findByOrganizationIdAndCreatedAtBetween(any(), any(), any()))
                .thenReturn(List.of(
                        SearchFeedback.builder().wasFound(true).createdAt(LocalDateTime.of(2026, 5, 2, 9, 0)).build(),
                        SearchFeedback.builder().wasFound(true).createdAt(LocalDateTime.of(2026, 5, 2, 10, 0)).build(),
                        SearchFeedback.builder().wasFound(false).createdAt(LocalDateTime.of(2026, 5, 4, 9, 0)).build()
                ));
        when(organizationFeedbackRepository.findByOrganizationIdAndCreatedAtBetween(any(), any(), any()))
                .thenReturn(List.of());

        FeedbackReportDto report = service.getReport(responsable(), FROM, TO, "DAY", null);

        assertThat(report.getTotalFeedback()).isEqualTo(3L);
        assertThat(report.getSuccessfulSearches()).isEqualTo(2L);
        assertThat(report.getUnsuccessfulSearches()).isEqualTo(1L);
        assertThat(report.getTimeSeries()).hasSize(2);
    }

    // Cada responsable ve solo su propia organizacion.
    @Test
    void getReport_pideLasCalificacionesDeSuPropiaOrganizacion() {
        when(feedbackRepository.findByOrganizationIdAndCreatedAtBetween(any(), any(), any()))
                .thenReturn(List.of());
        when(organizationFeedbackRepository.findByOrganizationIdAndCreatedAtBetween(any(), any(), any()))
                .thenReturn(List.of());

        service.getReport(responsable(), FROM, TO, "DAY", null);

        verify(organizationFeedbackRepository).findByOrganizationIdAndCreatedAtBetween(
                ORG_ID, FROM.atStartOfDay(), TO.plusDays(1).atStartOfDay());
    }

    // Sin calificaciones todavia, el reporte se muestra en cero en lugar de romperse.
    @Test
    void getReport_sinCalificacionesMuestraCerosYNingunComentario() {
        when(feedbackRepository.findByOrganizationIdAndCreatedAtBetween(any(), any(), any()))
                .thenReturn(List.of());
        when(organizationFeedbackRepository.findByOrganizationIdAndCreatedAtBetween(any(), any(), any()))
                .thenReturn(List.of());

        FeedbackReportDto report = service.getReport(responsable(), FROM, TO, "DAY", null);

        assertThat(report.getTotalRatings()).isZero();
        assertThat(report.getComments()).isEmpty();
        assertThat(report.getAspectAverages()).containsValue(0.0);
    }

    // El reporte sigue siendo del responsable de organizacion, no de cualquiera.
    @Test
    void getReport_rechazaAQuienNoEsResponsableDeOrganizacion() {
        assertThatThrownBy(() -> service.getReport(usuarioFinal(), FROM, TO, "DAY", null))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(organizationFeedbackRepository);
    }
}
