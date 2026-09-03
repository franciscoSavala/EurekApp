package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.request.SubmitOrganizationFeedbackRequestDto;
import com.eurekapp.backend.dto.response.OrganizationFeedbackSurveyDto;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.service.OrganizationFeedbackService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * EU-371: la calificación de la atención de una organización, colgada de una devolución concreta.
 * Se llega desde el enlace del correo que recibe quien retiró el objeto.
 */
@RestController
@RequestMapping("/organization-feedback")
@CrossOrigin("*")
@Tag(name = "Organization Feedback", description = "Calificación de la atención recibida al retirar un objeto")
@SecurityRequirement(name = "bearerAuth")
public class OrganizationFeedbackController {

    private final OrganizationFeedbackService service;

    public OrganizationFeedbackController(OrganizationFeedbackService service) {
        this.service = service;
    }

    @GetMapping("/{returnId}")
    @Operation(summary = "Datos de la encuesta de atención",
            description = "Organización, objeto retirado y si esa devolución ya fue calificada. Solo para quien retiró.")
    public ResponseEntity<OrganizationFeedbackSurveyDto> getSurvey(
            @AuthenticationPrincipal UserEurekapp user,
            @PathVariable Long returnId) {
        return ResponseEntity.ok(service.getSurvey(user, returnId));
    }

    @PostMapping("/{returnId}")
    @Operation(summary = "Calificar la atención recibida",
            description = "Registra los cinco aspectos y el comentario. Una devolución admite una sola calificación.")
    public ResponseEntity<Void> submit(
            @AuthenticationPrincipal UserEurekapp user,
            @PathVariable Long returnId,
            @Valid @RequestBody SubmitOrganizationFeedbackRequestDto dto) {
        service.submit(user, returnId, dto);
        return ResponseEntity.ok().build();
    }
}
