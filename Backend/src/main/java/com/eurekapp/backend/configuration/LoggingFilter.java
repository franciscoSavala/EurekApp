package com.eurekapp.backend.configuration;

import com.eurekapp.backend.service.FoundObjectService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;

@Component
public class LoggingFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(FoundObjectService.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        // Log de la solicitud
        logger.info("Request: URI {} Method {}", request.getRequestURI(), request.getMethod());

        // Continuar con la cadena de filtros
        filterChain.doFilter(request, response);

        // Log de la respuesta
        logger.info("Response Status: {}", response.getStatus());
    }
}
