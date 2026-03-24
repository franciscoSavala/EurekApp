package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.response.StatsResponseDto;
import com.eurekapp.backend.service.StatsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/stats")
@CrossOrigin("*")
@Tag(name = "Estadísticas", description = "Métricas generales de uso de la plataforma (endpoint público)")
public class StatsController {

    @Autowired
    private StatsService statsService;

    @GetMapping
    @Operation(summary = "Obtener estadísticas", description = "Devuelve métricas de uso: cantidad de objetos registrados, devueltos, usuarios activos, etc.")
    public ResponseEntity<StatsResponseDto> getStats() {
        return ResponseEntity.ok(statsService.getStats());
    }
}
