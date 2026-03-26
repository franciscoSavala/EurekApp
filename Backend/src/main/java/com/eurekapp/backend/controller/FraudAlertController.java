package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.request.ResolveFraudAlertRequestDto;
import com.eurekapp.backend.dto.response.FraudAlertDto;
import com.eurekapp.backend.dto.response.FraudUserReportEntryDto;
import com.eurekapp.backend.model.FraudAlertStatus;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.service.FraudDetectionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/fraud-alerts")
@CrossOrigin("*")
@Tag(name = "Fraud Alerts", description = "Gestión de alertas de fraude para encargados de organización")
@SecurityRequirement(name = "bearerAuth")
public class FraudAlertController {

    private final FraudDetectionService service;

    public FraudAlertController(FraudDetectionService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "Listar alertas de fraude", description = "Devuelve todas las alertas de fraude de la organización del usuario autenticado.")
    public ResponseEntity<List<FraudAlertDto>> getAlerts(
            @AuthenticationPrincipal UserEurekapp user) {
        return ResponseEntity.ok(service.getAlerts(user));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Detalle de una alerta de fraude")
    public ResponseEntity<FraudAlertDto> getDetail(
            @PathVariable Long id,
            @AuthenticationPrincipal UserEurekapp user) {
        return ResponseEntity.ok(service.getAlertDetail(id, user));
    }

    @PostMapping("/{id}/resolve")
    @Operation(summary = "Resolver una alerta de fraude", description = "Marca la alerta como CONFIRMED_FRAUD o FALSE_POSITIVE.")
    public ResponseEntity<Void> resolve(
            @PathVariable Long id,
            @AuthenticationPrincipal UserEurekapp user,
            @Valid @RequestBody ResolveFraudAlertRequestDto dto) {
        service.resolve(id, user, dto.getResolution());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/report")
    @Operation(summary = "Reporte de usuarios con fraude", description = "Agrupa las alertas por usuario sospechoso con métricas y acción sugerida. Solo ORGANIZATION_OWNER.")
    public ResponseEntity<List<FraudUserReportEntryDto>> getFraudReport(
            @AuthenticationPrincipal UserEurekapp user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) FraudAlertStatus status) {
        return ResponseEntity.ok(service.getFraudUserReport(user, from, to, status));
    }

    @GetMapping("/report/export")
    @Operation(summary = "Exportar reporte de fraude en CSV")
    public ResponseEntity<byte[]> exportFraudReport(
            @AuthenticationPrincipal UserEurekapp user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) FraudAlertStatus status) {
        byte[] csv = service.exportFraudReportCsv(user, from, to, status);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"fraud-report.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }
}
