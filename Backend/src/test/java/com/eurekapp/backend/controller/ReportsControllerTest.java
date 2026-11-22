package com.eurekapp.backend.controller;

import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.service.ReportsService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class ReportsControllerTest {

    @Test
    void conElRangoInvertido_noSeGeneraElReporteYSeRechazaConUn400() {
        ReportsService service = mock(ReportsService.class);
        ReportsController controller = new ReportsController(service);

        BadRequestException e = assertThrows(BadRequestException.class,
                () -> controller.getReports(null, "2026-08-01", "2026-07-31", "DAY"));

        assertEquals("La fecha \"Desde\" no puede ser posterior a la fecha \"Hasta\".", e.getMessage());
        verifyNoInteractions(service);
    }
}
