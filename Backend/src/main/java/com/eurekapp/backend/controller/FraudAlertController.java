package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.response.FraudAlertDto;
import com.eurekapp.backend.model.FraudAlertStatus;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.service.FraudDetectionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "Fraud Alerts", description = "Gestión de alertas de fraude para el dueño de Eurekapp (ADMIN)")
@SecurityRequirement(name = "bearerAuth")
public class FraudAlertController {

    private final FraudDetectionService service;

    public FraudAlertController(FraudDetectionService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "Listar alertas de fraude", description = "Devuelve todas las alertas de fraude (globales). Solo ADMIN.")
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
    @Operation(summary = "Marcar una alerta como falsa alarma",
            description = "Única acción posible sobre una alerta: la marca como falsa alarma y levanta el bloqueo. Solo ADMIN.")
    public ResponseEntity<Void> markFalseAlarm(
            @PathVariable Long id,
            @AuthenticationPrincipal UserEurekapp user) {
        service.markFalseAlarm(id, user);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/report")
    @Operation(summary = "Reporte de fraude (global)",
            description = "Agrupa las alertas por usuario o por DNI según 'groupBy'. Solo ADMIN.")
    public ResponseEntity<?> getFraudReport(
            @AuthenticationPrincipal UserEurekapp user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) FraudAlertStatus status,
            @RequestParam(defaultValue = "USER") String groupBy) {
        if ("DNI".equalsIgnoreCase(groupBy)) {
            return ResponseEntity.ok(service.getFraudDniReport(user, from, to, status));
        }
        return ResponseEntity.ok(service.getFraudUserReport(user, from, to, status));
    }

    @GetMapping("/report/export")
    @Operation(summary = "Exportar reporte de fraude en CSV")
    public ResponseEntity<byte[]> exportFraudReport(
            @AuthenticationPrincipal UserEurekapp user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) FraudAlertStatus status,
            @RequestParam(defaultValue = "USER") String groupBy) {
        byte[] csv = service.exportFraudReportCsv(user, from, to, status, groupBy);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"fraud-report.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }
}
