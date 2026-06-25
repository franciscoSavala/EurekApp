package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.request.UpdateFraudDetectionConfigRequest;
import com.eurekapp.backend.dto.response.FraudDetectionConfigDto;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.service.FraudDetectionConfigService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AllArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admin/fraud/config")
@CrossOrigin("*")
@AllArgsConstructor
@Tag(name = "Administración", description = "Operaciones exclusivas del administrador de EurekApp")
@SecurityRequirement(name = "bearerAuth")
public class FraudDetectionConfigController {

    private final FraudDetectionConfigService configService;

    @GetMapping
    @Operation(summary = "Ver configuración de detección de fraude", description = "Devuelve los parámetros N y T actuales. Solo ADMIN.")
    public ResponseEntity<FraudDetectionConfigDto> getConfig(
            @AuthenticationPrincipal UserEurekapp admin) {
        return ResponseEntity.ok(configService.getConfig(admin));
    }

    @PutMapping
    @Operation(summary = "Actualizar configuración de detección de fraude", description = "Actualiza los parámetros N (umbral) y T (ventana en días). Solo ADMIN.")
    public ResponseEntity<FraudDetectionConfigDto> updateConfig(
            @AuthenticationPrincipal UserEurekapp admin,
            @RequestBody @Valid UpdateFraudDetectionConfigRequest request) {
        return ResponseEntity.ok(configService.updateConfig(admin, request.getFraudThreshold(), request.getFraudWindowDays(), request.getBlockDurationDays()));
    }
}
