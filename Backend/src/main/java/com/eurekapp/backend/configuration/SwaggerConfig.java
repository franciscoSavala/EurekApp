package com.eurekapp.backend.configuration;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("EurekApp API")
                        .description("API para la gestión de objetos perdidos y encontrados. " +
                                "Para endpoints protegidos, autenticarse primero con /login y usar el token JWT en el botón 'Authorize'.")
                        .version("v0.0.1")
                        .contact(new Contact()
                                .name("UTN FRC — Proyecto Final 2024")))
                .components(new Components()
                        .addSecuritySchemes("bearerAuth", new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Ingresá el token JWT obtenido del endpoint /login")));
    }
}
