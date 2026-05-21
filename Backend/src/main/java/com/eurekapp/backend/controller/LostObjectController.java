package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.command.ReportLostObjectCommand;
import com.eurekapp.backend.dto.response.LostObjectResponseDto;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.service.LostObjectService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/lost-objects")
@CrossOrigin("*")
@Tag(name = "Objetos Perdidos", description = "Reporte de búsquedas abiertas de objetos perdidos")
@SecurityRequirement(name = "bearerAuth")
public class LostObjectController {

    @Autowired
    private LostObjectService lostObjectService;

    @PostMapping
    @Operation(summary = "Reportar objeto perdido",
            description = "Registra una búsqueda abierta de un objeto perdido con descripción, fecha y coordenadas aproximadas.")
    public ResponseEntity<Void> reportLostObject(@Valid @RequestBody ReportLostObjectCommand command) {
        lostObjectService.reportLostObject(command);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/my")
    @Operation(summary = "Mis búsquedas abiertas",
            description = "Retorna las búsquedas abiertas registradas por el usuario autenticado.")
    public ResponseEntity<List<LostObjectResponseDto>> getMyLostObjects(
            @AuthenticationPrincipal UserEurekapp user) {
        return ResponseEntity.ok(lostObjectService.getMyLostObjects(user.getUsername()));
    }
}
