package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.request.ToggleActiveDto;
import com.eurekapp.backend.dto.response.AdminOrganizationDto;
import com.eurekapp.backend.dto.response.AdminStatsDto;
import com.eurekapp.backend.dto.response.AdminUserDto;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.service.AdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AllArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/admin")
@CrossOrigin("*")
@AllArgsConstructor
@Tag(name = "Administración", description = "Operaciones exclusivas del administrador de EurekApp")
@SecurityRequirement(name = "bearerAuth")
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/stats")
    @Operation(summary = "Estadísticas globales", description = "Devuelve métricas globales de la plataforma. Solo ADMIN.")
    public ResponseEntity<AdminStatsDto> getAdminStats(
            @AuthenticationPrincipal UserEurekapp admin) {
        return ResponseEntity.ok(adminService.getAdminStats(admin));
    }

    @GetMapping("/users")
    @Operation(summary = "Listar usuarios", description = "Devuelve todos los usuarios. Filtrable por rol. Solo ADMIN.")
    public ResponseEntity<List<AdminUserDto>> getUsers(
            @AuthenticationPrincipal UserEurekapp admin,
            @RequestParam(required = false) String role) {
        return ResponseEntity.ok(adminService.getUsers(admin, role));
    }

    @PutMapping("/users/{id}/active")
    @Operation(summary = "Activar/desactivar usuario", description = "Cambia el estado activo de un usuario. Solo ADMIN.")
    public ResponseEntity<Void> toggleUserActive(
            @AuthenticationPrincipal UserEurekapp admin,
            @PathVariable Long id,
            @RequestBody @Valid ToggleActiveDto dto) {
        adminService.toggleUserActive(admin, id, dto.getActive());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/organizations")
    @Operation(summary = "Listar organizaciones", description = "Devuelve todas las organizaciones con estado y empleados. Solo ADMIN.")
    public ResponseEntity<List<AdminOrganizationDto>> getOrganizations(
            @AuthenticationPrincipal UserEurekapp admin) {
        return ResponseEntity.ok(adminService.getOrganizations(admin));
    }

    @PutMapping("/organizations/{id}/active")
    @Operation(summary = "Activar/desactivar organización", description = "Cambia el estado activo de una organización. Solo ADMIN.")
    public ResponseEntity<Void> toggleOrganizationActive(
            @AuthenticationPrincipal UserEurekapp admin,
            @PathVariable Long id,
            @RequestBody @Valid ToggleActiveDto dto) {
        adminService.toggleOrganizationActive(admin, id, dto.getActive());
        return ResponseEntity.noContent().build();
    }
}
