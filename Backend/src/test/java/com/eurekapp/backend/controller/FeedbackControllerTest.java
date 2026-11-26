package com.eurekapp.backend.controller;

import com.eurekapp.backend.exception.Handler;
import com.eurekapp.backend.service.FeedbackService;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class FeedbackControllerTest {

    @Test
    void pedirElReporteConUnaOrganizacionNoNumerica_seRechazaConUn400SinGenerarElReporte() throws Exception {
        FeedbackService service = mock(FeedbackService.class);
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new FeedbackController(service))
                .setControllerAdvice(new Handler())
                .build();

        mockMvc.perform(get("/feedback/report").param("organizationId", "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("invalid_parameter"));

        verifyNoInteractions(service);
    }
}
