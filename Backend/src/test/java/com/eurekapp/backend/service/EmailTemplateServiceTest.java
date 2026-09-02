package com.eurekapp.backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.thymeleaf.TemplateEngine;
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
 */
class EmailTemplateServiceTest {

    private EmailTemplateService service;

    @BeforeEach
    void setUp() {
        // Mismo resolver que arma Spring Boot para Thymeleaf: classpath:/templates/*.html
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/");
        resolver.setSuffix(".html");
        resolver.setTemplateMode(TemplateMode.HTML);
        resolver.setCharacterEncoding("UTF-8");
        // SpringTemplateEngine y no TemplateEngine a secas: el motor base evalúa ${} con OGNL,
        // que no está en el classpath. La aplicación usa el de Spring, que resuelve con SpEL.
        SpringTemplateEngine engine = new SpringTemplateEngine();
        engine.setTemplateResolver(resolver);
        service = new EmailTemplateService(engine);
    }

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
}
