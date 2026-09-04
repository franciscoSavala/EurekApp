package com.eurekapp.backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import static org.assertj.core.api.Assertions.assertThat;

/* EU-373: el correo que ya se le enviaba a quien recupero su objeto suma la invitacion a calificar
 * la atencion recibida. Se renderiza la plantilla de verdad: lo que importa es que el enlace llegue
 * al correo, no que se haya seteado una variable. */
class EmailTemplateServiceTest {

    private static final String FRONT_URL = "http://localhost:8082";

    EmailTemplateService service;

    @BeforeEach
    void setUp() {
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/");
        resolver.setSuffix(".html");
        resolver.setTemplateMode(TemplateMode.HTML);
        resolver.setCharacterEncoding("UTF-8");
        SpringTemplateEngine engine = new SpringTemplateEngine();
        engine.setTemplateResolver(resolver);
        service = new EmailTemplateService(engine, FRONT_URL);
    }

    private static final String TOKEN = "8f2b1c7e-4d0a-4f31-9b6e-2a5c7d1e0f44";

    private String correoRecuperado(String surveyToken) {
        return service.buildObjectRecoveredEmail(
                "Julia", "Billetera negra", "UTN FRC", "03/09/2026 15:30", surveyToken);
    }

    /* El correo lleva el boton y un enlace con el TOKEN de la encuesta. No lleva el id de la
     * devolucion: es secuencial y quedaria a la vista en la barra de direcciones. */
    @Test
    void correoDeObjetoRecuperado_invitaACalificarConElTokenDeEsaEncuesta() {
        String html = correoRecuperado(TOKEN);

        assertThat(html).contains("¿Cómo te atendieron?");
        assertThat(html).contains("Calificar la atención");
        assertThat(html).contains(FRONT_URL + "/OrganizationFeedbackSurvey?token=" + TOKEN);
        assertThat(html).doesNotContain("returnId");
    }

    // Sigue siendo el mismo correo de siempre: la invitacion se suma, no reemplaza nada.
    @Test
    void correoDeObjetoRecuperado_conservaLaConfirmacionDeLaRecuperacion() {
        String html = correoRecuperado(TOKEN);

        assertThat(html).contains("Julia");
        assertThat(html).contains("Billetera negra");
        assertThat(html).contains("UTN FRC");
        assertThat(html).contains("03/09/2026 15:30");
    }

    /* Sin token no hay a que apuntar el enlace. Antes que mandar un enlace que no lleva a ningun
     * lado, el correo sale sin la invitacion. */
    @Test
    void correoDeObjetoRecuperado_sinTokenDeEncuesta_saleSinInvitacion() {
        String html = correoRecuperado(null);

        assertThat(html).doesNotContain("Calificar la atención");
        assertThat(html).doesNotContain("OrganizationFeedbackSurvey");
        // Pero el correo se envia igual, con su contenido de siempre.
        assertThat(html).contains("Billetera negra");
    }

    // La URL configurada puede venir con barra final; el enlace no debe quedar con dos.
    @Test
    void enlaceDeLaEncuesta_noDuplicaLaBarraFinalDeLaUrlConfigurada() {
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/");
        resolver.setSuffix(".html");
        resolver.setTemplateMode(TemplateMode.HTML);
        resolver.setCharacterEncoding("UTF-8");
        SpringTemplateEngine engine = new SpringTemplateEngine();
        engine.setTemplateResolver(resolver);
        EmailTemplateService conBarra = new EmailTemplateService(engine, "https://eurekapp.com/");

        String html = conBarra.buildObjectRecoveredEmail(
                "Julia", "Billetera negra", "UTN FRC", "03/09/2026 15:30", TOKEN);

        assertThat(html).contains("https://eurekapp.com/OrganizationFeedbackSurvey?token=" + TOKEN);
        assertThat(html).doesNotContain("eurekapp.com//");
    }
}
