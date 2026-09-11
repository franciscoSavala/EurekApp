package com.eurekapp.backend.configuration.security;

import com.eurekapp.backend.exception.ApiError;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.servlet.HandlerExceptionResolver;
import org.springframework.web.servlet.ModelAndView;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * EU-363: una falla que nadie contempló no puede terminar en una respuesta que diga "todo salió
 * bien". Es lo que escondió EU-352 durante meses.
 */
@ExtendWith(MockitoExtension.class)
class FilterChainExceptionHandlerTest {

    @Mock
    private HandlerExceptionResolver resolver;

    @Mock
    private FilterChain filterChain;

    private FilterChainExceptionHandler filter;
    private MockHttpServletRequest request;
    private MockHttpServletResponse response;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        filter = new FilterChainExceptionHandler();
        ReflectionTestUtils.setField(filter, "resolver", resolver);
        request = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
    }

    @Test
    void unaFallaNoContempladaRespondeErrorYNoUnExito() throws Exception {
        doThrow(new IllegalStateException("la base rechazó el dato"))
                .when(filterChain).doFilter(any(), any());
        when(resolver.resolveException(any(), any(), any(), any())).thenReturn(null);

        filter.doFilter(request, response, filterChain);

        assertEquals(500, response.getStatus());
        ApiError error = objectMapper.readValue(response.getContentAsString(), ApiError.class);
        assertEquals("internal_error", error.getError());
        assertEquals(500, error.getStatus());
        assertTrue(response.getContentType().contains("application/json"));
    }

    @Test
    void elCuerpoDelErrorNoQuedaVacio() throws Exception {
        doThrow(new RuntimeException("falla")).when(filterChain).doFilter(any(), any());
        when(resolver.resolveException(any(), any(), any(), any())).thenReturn(null);

        filter.doFilter(request, response, filterChain);

        assertTrue(response.getContentAsString().length() > 0);
    }

    @Test
    void siLaExcepcionYaTieneTratamientoPropioNoSePisaLaRespuesta() throws Exception {
        doThrow(new RuntimeException("ya mapeada")).when(filterChain).doFilter(any(), any());
        // El resolver devuelve algo: la excepción tenía su @ExceptionHandler y ya escribió su respuesta.
        when(resolver.resolveException(any(), any(), any(), any())).thenReturn(new ModelAndView());

        filter.doFilter(request, response, filterChain);

        assertEquals(200, response.getStatus()); // lo que haya dejado el handler, intacto
        assertEquals("", response.getContentAsString());
    }

    @Test
    void unaPeticionSinFallasNoSeToca() throws Exception {
        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        assertEquals(200, response.getStatus());
        assertEquals("", response.getContentAsString());
    }
}
