package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.request.SubmitOrganizationFeedbackRequestDto;
import com.eurekapp.backend.dto.response.OrganizationFeedbackSurveyDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.FoundObject;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.OrganizationFeedback;
import com.eurekapp.backend.model.ReturnFoundObject;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.FoundObjectRepository;
import com.eurekapp.backend.repository.IOrganizationFeedbackRepository;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.IReturnFoundObjectRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/* EU-371: la calificacion de la organizacion cuelga de la devolucion concreta. Es lo que garantiza
 * que se califique a la organizacion correcta, una sola vez, y solo por quien retiro el objeto. */
@ExtendWith(MockitoExtension.class)
class OrganizationFeedbackServiceTest {

    @Mock IOrganizationFeedbackRepository repository;
    @Mock IReturnFoundObjectRepository returnFoundObjectRepository;
    @Mock IOrganizationRepository organizationRepository;
    @Mock FoundObjectRepository foundObjectRepository;

    OrganizationFeedbackService service;

    private static final Long RETURN_ID = 55L;
    private static final Long ORG_ID = 3L;
    // EU-374: la encuesta se abre con un token opaco, nunca con el id de la devolucion.
    private static final String TOKEN = "8f2b1c7e-4d0a-4f31-9b6e-2a5c7d1e0f44";
    private static final String OTRO_TOKEN = "00000000-0000-0000-0000-000000000000";

    @BeforeEach
    void setUp() {
        service = new OrganizationFeedbackService(
                repository, returnFoundObjectRepository, organizationRepository, foundObjectRepository);
    }

    private UserEurekapp quienRetiro() {
        return UserEurekapp.builder().id(9L).role(Role.USER).username("julia@mail.com").build();
    }

    private UserEurekapp otraPersona() {
        return UserEurekapp.builder().id(10L).role(Role.USER).username("pedro@mail.com").build();
    }

    private ReturnFoundObject devolucion(UserEurekapp retirador, Long organizationId) {
        ReturnFoundObject rfo = new ReturnFoundObject();
        rfo.setId(RETURN_ID);
        rfo.setUserEurekapp(retirador);
        rfo.setOrganizationId(organizationId);
        rfo.setFoundObjectUUID("uuid-objeto");
        rfo.setFeedbackToken(TOKEN);
        return rfo;
    }

    private SubmitOrganizationFeedbackRequestDto respuesta() {
        return SubmitOrganizationFeedbackRequestDto.builder()
                .staffTreatment(5)
                .waitingTime(4)
                .instructionsClarity(3)
                .objectCondition(5)
                .pickupSecurity(4)
                .comment("Me atendieron muy bien")
                .build();
    }

    // -- Registrar la calificacion --------------------------------------------

    @Test
    void submit_guardaLosCincoAspectosLigadosALaDevolucion() {
        UserEurekapp usuario = quienRetiro();
        ReturnFoundObject rfo = devolucion(usuario, ORG_ID);
        when(returnFoundObjectRepository.findByFeedbackToken(TOKEN)).thenReturn(Optional.of(rfo));
        when(repository.existsByReturnFoundObject_Id(RETURN_ID)).thenReturn(false);

        service.submit(usuario, TOKEN, respuesta());

        ArgumentCaptor<OrganizationFeedback> guardado = ArgumentCaptor.forClass(OrganizationFeedback.class);
        verify(repository).save(guardado.capture());
        OrganizationFeedback fb = guardado.getValue();
        assertThat(fb.getReturnFoundObject()).isSameAs(rfo);
        // La organizacion sale de la devolucion, no de lo que mande el cliente.
        assertThat(fb.getOrganizationId()).isEqualTo(ORG_ID);
        assertThat(fb.getUser()).isSameAs(usuario);
        assertThat(fb.getStaffTreatment()).isEqualTo(5);
        assertThat(fb.getWaitingTime()).isEqualTo(4);
        assertThat(fb.getInstructionsClarity()).isEqualTo(3);
        assertThat(fb.getObjectCondition()).isEqualTo(5);
        assertThat(fb.getPickupSecurity()).isEqualTo(4);
        assertThat(fb.getComment()).isEqualTo("Me atendieron muy bien");
        assertThat(fb.getCreatedAt()).isNotNull();
    }

    // El comentario es opcional: en blanco se guarda como ausente, no como cadena vacia.
    @Test
    void submit_guardaSinComentarioCuandoVieneEnBlanco() {
        UserEurekapp usuario = quienRetiro();
        when(returnFoundObjectRepository.findByFeedbackToken(TOKEN))
                .thenReturn(Optional.of(devolucion(usuario, ORG_ID)));
        when(repository.existsByReturnFoundObject_Id(RETURN_ID)).thenReturn(false);

        SubmitOrganizationFeedbackRequestDto dto = respuesta();
        dto.setComment("   ");
        service.submit(usuario, TOKEN, dto);

        ArgumentCaptor<OrganizationFeedback> guardado = ArgumentCaptor.forClass(OrganizationFeedback.class);
        verify(repository).save(guardado.capture());
        assertThat(guardado.getValue().getComment()).isNull();
    }

    // -- Una devolucion, una calificacion -------------------------------------

    @Test
    void submit_rechazaSiEsaDevolucionYaFueCalificada() {
        UserEurekapp usuario = quienRetiro();
        when(returnFoundObjectRepository.findByFeedbackToken(TOKEN))
                .thenReturn(Optional.of(devolucion(usuario, ORG_ID)));
        when(repository.existsByReturnFoundObject_Id(RETURN_ID)).thenReturn(true);

        assertThatThrownBy(() -> service.submit(usuario, TOKEN, respuesta()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Ya calificaste");
        verify(repository, never()).save(any());
    }

    // -- Solo la puede responder quien retiro ---------------------------------

    /* El identificador de la devolucion viaja a la vista en el enlace del correo. Sin esta
     * comprobacion, cualquiera con sesion podria calificar la atencion que recibio otra persona. */
    @Test
    void submit_rechazaLaDevolucionDeOtraPersona() {
        when(returnFoundObjectRepository.findByFeedbackToken(TOKEN))
                .thenReturn(Optional.of(devolucion(quienRetiro(), ORG_ID)));

        assertThatThrownBy(() -> service.submit(otraPersona(), TOKEN, respuesta()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("no es tuya");
        verify(repository, never()).save(any());
    }

    // Un retiro hecho por alguien sin cuenta no tiene a quien atribuirle la encuesta.
    @Test
    void submit_rechazaUnaDevolucionSinUsuarioAsociado() {
        when(returnFoundObjectRepository.findByFeedbackToken(TOKEN))
                .thenReturn(Optional.of(devolucion(null, ORG_ID)));

        assertThatThrownBy(() -> service.submit(quienRetiro(), TOKEN, respuesta()))
                .isInstanceOf(BadRequestException.class);
        verify(repository, never()).save(any());
    }

    // Un token que no corresponde a ninguna devolucion no dice nada mas que "no existe".
    @Test
    void submit_rechazaUnTokenDesconocido() {
        when(returnFoundObjectRepository.findByFeedbackToken(OTRO_TOKEN)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.submit(quienRetiro(), OTRO_TOKEN, respuesta()))
                .isInstanceOf(NotFoundException.class);
        verify(repository, never()).save(any());
    }

    // Sin token no hay encuesta que abrir.
    @Test
    void getSurvey_rechazaUnTokenVacio() {
        assertThatThrownBy(() -> service.getSurvey(quienRetiro(), "  "))
                .isInstanceOf(NotFoundException.class);
        verifyNoInteractions(returnFoundObjectRepository);
    }

    // Las devoluciones anteriores al ticket no guardaron organizacion: no se les inventa una.
    @Test
    void submit_rechazaUnaDevolucionSinOrganizacion() {
        UserEurekapp usuario = quienRetiro();
        when(returnFoundObjectRepository.findByFeedbackToken(TOKEN))
                .thenReturn(Optional.of(devolucion(usuario, null)));

        assertThatThrownBy(() -> service.submit(usuario, TOKEN, respuesta()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("anterior a la encuesta");
        verify(repository, never()).save(any());
    }

    // -- Lo que ve la pantalla antes de responder -----------------------------

    @Test
    void getSurvey_devuelveOrganizacionObjetoYQueTodaviaNoFueCalificada() {
        UserEurekapp usuario = quienRetiro();
        when(returnFoundObjectRepository.findByFeedbackToken(TOKEN))
                .thenReturn(Optional.of(devolucion(usuario, ORG_ID)));
        when(organizationRepository.findById(ORG_ID))
                .thenReturn(Optional.of(Organization.builder().id(ORG_ID).name("UTN FRC").build()));
        when(foundObjectRepository.getByUuid("uuid-objeto"))
                .thenReturn(FoundObject.builder().title("Billetera negra").build());
        when(repository.existsByReturnFoundObject_Id(RETURN_ID)).thenReturn(false);

        OrganizationFeedbackSurveyDto dto = service.getSurvey(usuario, TOKEN);

        assertThat(dto.getOrganizationName()).isEqualTo("UTN FRC");
        assertThat(dto.getObjectTitle()).isEqualTo("Billetera negra");
        assertThat(dto.getAlreadyRated()).isFalse();
    }

    // Si ya la calificó, la pantalla lo sabe y avisa en vez de dejarla responder de nuevo.
    @Test
    void getSurvey_avisaCuandoLaDevolucionYaFueCalificada() {
        UserEurekapp usuario = quienRetiro();
        when(returnFoundObjectRepository.findByFeedbackToken(TOKEN))
                .thenReturn(Optional.of(devolucion(usuario, ORG_ID)));
        when(organizationRepository.findById(ORG_ID))
                .thenReturn(Optional.of(Organization.builder().id(ORG_ID).name("UTN FRC").build()));
        when(foundObjectRepository.getByUuid(anyString()))
                .thenReturn(FoundObject.builder().title("Billetera negra").build());
        when(repository.existsByReturnFoundObject_Id(RETURN_ID)).thenReturn(true);

        assertThat(service.getSurvey(usuario, TOKEN).getAlreadyRated()).isTrue();
    }

    /* El titulo del objeto es contexto, no lo que se califica: si la base vectorial no responde, la
     * encuesta se muestra igual. */
    @Test
    void getSurvey_seMuestraAunqueNoSePuedaRecuperarElTituloDelObjeto() {
        UserEurekapp usuario = quienRetiro();
        when(returnFoundObjectRepository.findByFeedbackToken(TOKEN))
                .thenReturn(Optional.of(devolucion(usuario, ORG_ID)));
        when(organizationRepository.findById(ORG_ID))
                .thenReturn(Optional.of(Organization.builder().id(ORG_ID).name("UTN FRC").build()));
        when(foundObjectRepository.getByUuid(anyString()))
                .thenThrow(new RuntimeException("weaviate caido"));
        when(repository.existsByReturnFoundObject_Id(RETURN_ID)).thenReturn(false);

        OrganizationFeedbackSurveyDto dto = service.getSurvey(usuario, TOKEN);

        assertThat(dto.getObjectTitle()).isNull();
        assertThat(dto.getOrganizationName()).isEqualTo("UTN FRC");
    }

    @Test
    void getSurvey_rechazaLaDevolucionDeOtraPersona() {
        when(returnFoundObjectRepository.findByFeedbackToken(TOKEN))
                .thenReturn(Optional.of(devolucion(quienRetiro(), ORG_ID)));

        assertThatThrownBy(() -> service.getSurvey(otraPersona(), TOKEN))
                .isInstanceOf(BadRequestException.class);
    }
}
