package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.response.ReportsResponseDto;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.service.ReportsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/reports")
@CrossOrigin("*")
@Tag(name = "Reportes", description = "Reportes de uso del sistema para responsables de organización")
@SecurityRequirement(name = "bearerAuth")
public class ReportsController {

    private final ReportsService reportsService;

    public ReportsController(ReportsService reportsService) {
        this.reportsService = reportsService;
    }

    @GetMapping
    @Operation(
        summary = "Obtener reporte de uso",
        description = "Devuelve métricas de uso filtradas por rango de fechas. Solo accesible para ORGANIZATION_OWNER."
    )
    public ResponseEntity<ReportsResponseDto> getReports(
            @AuthenticationPrincipal UserEurekapp user,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false, defaultValue = "DAY") String groupBy
    ) {
        LocalDate fromDate = (from != null) ? LocalDate.parse(from) : LocalDate.now().minusDays(30);
        LocalDate toDate = (to != null) ? LocalDate.parse(to) : LocalDate.now();
        return ResponseEntity.ok(reportsService.getReports(user, fromDate, toDate, groupBy));
    }
}
