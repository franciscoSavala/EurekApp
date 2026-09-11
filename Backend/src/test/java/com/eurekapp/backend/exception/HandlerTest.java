package com.eurekapp.backend.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpRequestMethodNotSupportedException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * EU-363: red de último recurso para las excepciones que no tienen un tratamiento propio. Hasta
 * ahora salían como un 200 con el cuerpo vacío, o sea como una operación exitosa.
 */
class HandlerTest {

    private final Handler handler = new Handler();

    @Test
    void unaFallaInesperadaSaleComoErrorDelServidor() {
        ResponseEntity<ApiError> response =
                handler.handleUnexpectedException(new IllegalStateException("violación de integridad"));

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("internal_error", response.getBody().getError());
        assertEquals(500, response.getBody().getStatus());
    }

    @Test
    void elMensajeDeLaFallaInternaNoSeLeFiltraAlUsuario() {
        ResponseEntity<ApiError> response =
                handler.handleUnexpectedException(new IllegalStateException("jdbc://usuario:clave@servidor"));

        assertEquals("Ocurrió un error inesperado. Intentá de nuevo.", response.getBody().getMessage());
    }

    @Test
    void unaPeticionMalFormadaConservaSuPropioCodigo() {
        // Método HTTP no soportado: Spring ya sabe que esto es un 405, no una falla del servidor.
        ResponseEntity<ApiError> response = handler.handleUnexpectedException(
                new HttpRequestMethodNotSupportedException(HttpMethod.DELETE.name(), List.of("GET")));

        assertEquals(HttpStatus.METHOD_NOT_ALLOWED, response.getStatusCode());
        assertEquals("bad_request", response.getBody().getError());
        assertEquals(405, response.getBody().getStatus());
    }

    @Test
    void losErroresDeNegocioSiguenSaliendoComoAntes() {
        ResponseEntity<ApiError> response = handler.handleBadRequestException(
                new BadRequestException("dni_bloqueado", "El DNI está bloqueado por sospecha de fraude."));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("dni_bloqueado", response.getBody().getError());
        assertEquals("El DNI está bloqueado por sospecha de fraude.", response.getBody().getMessage());
    }

    @Test
    void elCuerpoDelErrorSiempreLlevaElMismoFormato() {
        ApiError error = handler.handleUnexpectedException(new RuntimeException("x")).getBody();

        assertNotNull(error.getError());
        assertNotNull(error.getMessage());
        assertNotNull(error.getStatus());
        assertNotNull(error.getDetails());
    }

    @Test
    void noSeRompeSiLaFallaNoTraeMensaje() {
        ResponseEntity<ApiError> response = handler.handleUnexpectedException(new NullPointerException());

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertEquals("internal_error", response.getBody().getError());
    }
}
