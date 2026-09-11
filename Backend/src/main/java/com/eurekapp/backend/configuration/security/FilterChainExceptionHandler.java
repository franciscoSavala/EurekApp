package com.eurekapp.backend.configuration.security;

import com.eurekapp.backend.exception.ApiError;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerExceptionResolver;

import java.io.IOException;
import java.util.List;

@Component
public class FilterChainExceptionHandler extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(FilterChainExceptionHandler.class);

    @Autowired
    @Qualifier("handlerExceptionResolver")
    private HandlerExceptionResolver resolver;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) {
        try {
            filterChain.doFilter(request, response);
        } catch (Exception e) {
            // EU-363: el resolver devuelve null cuando la excepción no tiene ningún @ExceptionHandler
            // que la atienda. Antes se ignoraba ese caso: el filtro terminaba sin escribir nada y el
            // servidor mandaba un 200 con el cuerpo vacío, que para el front es una operación
            // exitosa. Así se escondió EU-352 durante meses.
            if (resolver.resolveException(request, response, null, e) == null) {
                writeInternalError(response, e);
            }
        }
    }

    /** Última red: la falla no prevista viaja como 500 con el mismo cuerpo que el resto de los errores. */
    private void writeInternalError(HttpServletResponse response, Exception e) {
        log.error("Excepción no mapeada en la cadena de filtros", e);
        if (response.isCommitted()) return;

        ApiError apiError = ApiError.builder()
                .error("internal_error")
                .message("Ocurrió un error inesperado. Intentá de nuevo.")
                .status(HttpStatus.INTERNAL_SERVER_ERROR.value())
                .details(List.of(e.getClass().getSimpleName()))
                .build();

        response.setStatus(HttpStatus.INTERNAL_SERVER_ERROR.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        try {
            response.getWriter().write(objectMapper.writeValueAsString(apiError));
        } catch (IOException io) {
            log.error("No se pudo escribir la respuesta de error", io);
        }
    }
}
