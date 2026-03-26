package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.command.UpdateClaimStatusCommand;
import com.eurekapp.backend.dto.response.ReclamoDto;
import com.eurekapp.backend.model.ClaimStatus;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.service.ReclamoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/reclamos")
@CrossOrigin("*")
@Tag(name = "Reclamos", description = "Gestión de reclamos de objetos perdidos")
@SecurityRequirement(name = "bearerAuth")
public class ReclamoController {

    private final ReclamoService reclamoService;

    public ReclamoController(ReclamoService reclamoService) {
        this.reclamoService = reclamoService;
    }

    @GetMapping
    @Operation(summary = "Listar reclamos",
            description = "Devuelve los reclamos de la organización. Accesible para ENCARGADO y ORGANIZATION_OWNER.")
    public ResponseEntity<List<ReclamoDto>> getReclamos(
            @AuthenticationPrincipal UserEurekapp user,
            @RequestParam(required = false) ClaimStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "date") String sortBy) {
        return ResponseEntity.ok(reclamoService.getReclamos(user, status, from, to, category, sortBy));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Detalle de un reclamo",
            description = "Devuelve el detalle completo de un reclamo incluyendo objeto encontrado, historial y datos del usuario.")
    public ResponseEntity<ReclamoDto> getReclamoDetail(
            @AuthenticationPrincipal UserEurekapp user,
            @PathVariable Long id) {
        return ResponseEntity.ok(reclamoService.getReclamoDetail(user, id));
    }

    @PutMapping("/{id}/status")
    @Operation(summary = "Actualizar estado del reclamo",
            description = "Actualiza el estado del reclamo y registra la acción en el historial.")
    public ResponseEntity<Void> updateStatus(
            @AuthenticationPrincipal UserEurekapp user,
            @PathVariable Long id,
            @RequestBody UpdateClaimStatusCommand command) {
        reclamoService.updateStatus(user, id, command);
        return ResponseEntity.ok().build();
    }
}
