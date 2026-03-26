package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.request.ResolveFraudAlertRequestDto;
import com.eurekapp.backend.dto.response.FraudAlertDto;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.service.FraudDetectionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

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
}
