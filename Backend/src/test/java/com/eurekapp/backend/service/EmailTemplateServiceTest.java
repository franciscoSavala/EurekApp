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

    private String correoRecuperado(Long returnId) {
        return service.buildObjectRecoveredEmail(
                "Julia", "Billetera negra", "UTN FRC", "03/09/2026 15:30", returnId);
    }

    // El correo lleva el boton y un enlace que identifica de que devolucion se trata.
    @Test
    void correoDeObjetoRecuperado_invitaACalificarConElEnlaceDeEsaDevolucion() {
        String html = correoRecuperado(55L);

        assertThat(html).contains("¿Cómo te atendieron?");
        assertThat(html).contains("Calificar la atención");
        assertThat(html).contains(FRONT_URL + "/OrganizationFeedbackSurvey?returnId=55");
    }

    // Sigue siendo el mismo correo de siempre: la invitacion se suma, no reemplaza nada.
    @Test
    void correoDeObjetoRecuperado_conservaLaConfirmacionDeLaRecuperacion() {
        String html = correoRecuperado(55L);

        assertThat(html).contains("Julia");
        assertThat(html).contains("Billetera negra");
        assertThat(html).contains("UTN FRC");
        assertThat(html).contains("03/09/2026 15:30");
    }

    /* Sin devolucion identificada no hay a que apuntar el enlace. Antes que mandar un enlace que no
     * lleva a ningun lado, el correo sale sin la invitacion. */
    @Test
    void correoDeObjetoRecuperado_sinDevolucionIdentificada_saleSinInvitacion() {
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
                "Julia", "Billetera negra", "UTN FRC", "03/09/2026 15:30", 7L);

        assertThat(html).contains("https://eurekapp.com/OrganizationFeedbackSurvey?returnId=7");
        assertThat(html).doesNotContain("eurekapp.com//");
    }
}
