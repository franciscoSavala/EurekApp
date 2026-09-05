package com.eurekapp.backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * EU-353: las plantillas se renderizan de verdad, con el motor real.
 *
 * <p>Es la única red que las cubre. En el resto de los tests {@link EmailTemplateService} está
 * mockeado, así que una plantilla que no existe o que tiene mal una expresión no rompería ningún
 * test: fallaría recién en ejecución, y ahí la excepción cae en el {@code catch} que envuelve todo
 * envío de correo y termina en un {@code log.warn} que nadie mira. Con el renombre de
 * object-found → object-claimed eso pasó a ser un riesgo concreto.</p>
 *
 * <p>EU-373: por el mismo motivo se renderiza acá la invitación a calificar la atención que suma el
 * correo de objeto recuperado. Lo que importa es que el enlace llegue al correo, no que se haya
 * seteado una variable.</p>
 */
class EmailTemplateServiceTest {

    private static final String FRONT_URL = "http://localhost:8082";
    private static final String TOKEN = "8f2b1c7e-4d0a-4f31-9b6e-2a5c7d1e0f44";

    private EmailTemplateService service;

    /**
     * Mismo resolver que arma Spring Boot para Thymeleaf: classpath:/templates/*.html.
     *
     * <p>SpringTemplateEngine y no TemplateEngine a secas: el motor base evalúa {@code ${}} con
     * OGNL, que no está en el classpath. La aplicación usa el de Spring, que resuelve con SpEL.</p>
     */
    private static EmailTemplateService serviceConFrontUrl(String frontUrl) {
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/");
        resolver.setSuffix(".html");
        resolver.setTemplateMode(TemplateMode.HTML);
        resolver.setCharacterEncoding("UTF-8");
        SpringTemplateEngine engine = new SpringTemplateEngine();
        engine.setTemplateResolver(resolver);
        return new EmailTemplateService(engine, frontUrl);
    }

    @BeforeEach
    void setUp() {
        service = serviceConFrontUrl(FRONT_URL);
    }

    // -- EU-353: correo de reclamo y alerta de fraude --------------------------

    @Test
    void objectClaimed_renderizaLosDatosDelRetiro() {
        String html = service.buildObjectClaimedEmail(
                "Ana", "Mochila azul", "Tiene un llavero de tela",
                "UTN FRC", "consultas@utn.edu.ar / 351 555-0000");

        assertThat(html)
                .contains("Ana")
                .contains("Mochila azul")
                .contains("Tiene un llavero de tela")
                .contains("UTN FRC")
                .contains("consultas@utn.edu.ar");
        // Lo que hasta ahora sólo vivía en el modal y se perdía al cerrarlo.
        assertThat(html).contains("documento");
    }

    @Test
    void objectClaimed_noLlevaImagen() {
        // El correo va sin foto a propósito: el objeto ya lo vio en la aplicación al reconocerlo, y
        // los clientes de correo suelen bloquear las imágenes remotas y mostrar el texto alternativo
        // en su lugar, que es exactamente lo que se veía.
        String html = service.buildObjectClaimedEmail(
                "Ana", "Mochila azul", "Tiene un llavero de tela",
                "UTN FRC", "consultas@utn.edu.ar");

        assertThat(html).doesNotContain("<img");
    }

    @Test
    void objectClaimed_sinDescripcion_noDejaUnParrafoVacio() {
        // humanDescription puede venir vacía: en ese caso el bloque muestra sólo el título.
        String html = service.buildObjectClaimedEmail(
                "Ana", "Mochila azul", null, "UTN FRC", "consultas@utn.edu.ar");

        assertThat(html).contains("Mochila azul").doesNotContain("null");
    }

    @Test
    void fraudAlert_renderizaElCasoYNoNombraUnaOrganizacion() {
        // DNI de prueba, inventado.
        String html = service.buildFraudAlertEmail(
                "Retiros repetidos del mismo DNI",
                "DNI 30111222 — Caso 1: 5 devoluciones del mismo DNI.",
                "30111222",
                "02/09/2026 14:30");

        assertThat(html)
                .contains("30111222")
                .contains("Retiros repetidos del mismo DNI")
                .contains("02/09/2026 14:30");
        // Las alertas nuevas son globales: no hay organización que nombrar, y "confirmar fraude"
        // dejó de existir como acción cuando el modelo pasó a dos estados.
        assertThat(html).doesNotContain("confirmar fraude");
    }

    // -- EU-373: la invitación a calificar la atención -------------------------

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
        EmailTemplateService conBarra = serviceConFrontUrl("https://eurekapp.com/");

        String html = conBarra.buildObjectRecoveredEmail(
                "Julia", "Billetera negra", "UTN FRC", "03/09/2026 15:30", TOKEN);

        assertThat(html).contains("https://eurekapp.com/OrganizationFeedbackSurvey?token=" + TOKEN);
        assertThat(html).doesNotContain("eurekapp.com//");
    }
}
