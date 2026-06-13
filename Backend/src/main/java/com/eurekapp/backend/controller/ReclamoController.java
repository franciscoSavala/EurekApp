package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.request.CreateReclamoRequestDto;
import com.eurekapp.backend.dto.response.ReclamoDto;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.service.ReclamoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
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

    @PostMapping
    @Operation(summary = "Registrar reclamo",
            description = "Registra el reclamo del usuario sobre un objeto encontrado. Accesible para usuarios autenticados.")
    public ResponseEntity<ReclamoDto> createReclamo(
            @AuthenticationPrincipal UserEurekapp user,
            @RequestBody CreateReclamoRequestDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(reclamoService.createReclamoForUser(user, dto));
    }

    @GetMapping
    @Operation(summary = "Listar reclamos",
            description = "Devuelve los reclamos de la organización. Accesible para ENCARGADO y ORGANIZATION_OWNER.")
    public ResponseEntity<List<ReclamoDto>> getReclamos(
            @AuthenticationPrincipal UserEurekapp user,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "date") String sortBy) {
        return ResponseEntity.ok(reclamoService.getReclamos(user, from, to, category, sortBy));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Detalle de un reclamo",
            description = "Devuelve el detalle completo de un reclamo incluyendo objeto encontrado, historial y datos del usuario.")
    public ResponseEntity<ReclamoDto> getReclamoDetail(
            @AuthenticationPrincipal UserEurekapp user,
            @PathVariable Long id) {
        return ResponseEntity.ok(reclamoService.getReclamoDetail(user, id));
    }

    @GetMapping("/my")
    @Operation(summary = "Mis búsquedas guardadas",
            description = "Devuelve el historial de reclamos del usuario autenticado (rol USER).")
    public ResponseEntity<List<ReclamoDto>> getMyReclamos(@AuthenticationPrincipal UserEurekapp user) {
        return ResponseEntity.ok(reclamoService.getMyReclamos(user));
    }

    @GetMapping("/my/{id}")
    @Operation(summary = "Detalle de mi búsqueda guardada",
            description = "Devuelve el detalle completo de uno de los reclamos del usuario autenticado.")
    public ResponseEntity<ReclamoDto> getMyReclamoDetail(
            @AuthenticationPrincipal UserEurekapp user,
            @PathVariable Long id) {
        return ResponseEntity.ok(reclamoService.getMyReclamoDetail(user, id));
    }

}
