package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.request.SubmitUsabilityFeedbackRequestDto;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.service.UsabilityFeedbackService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/usability-feedback")
@CrossOrigin("*")
@Tag(name = "Usability Feedback", description = "Feedback de los usuarios sobre la usabilidad del sistema")
@SecurityRequirement(name = "bearerAuth")
public class UsabilityFeedbackController {

    private final UsabilityFeedbackService service;

    public UsabilityFeedbackController(UsabilityFeedbackService service) {
        this.service = service;
    }

    @PostMapping
    @Operation(summary = "Enviar feedback de usabilidad", description = "Registra el feedback del usuario sobre la experiencia de uso de la aplicación.")
    public ResponseEntity<Void> submit(
            @AuthenticationPrincipal UserEurekapp user,
            @Valid @RequestBody SubmitUsabilityFeedbackRequestDto dto) {
        service.submit(user, dto);
        return ResponseEntity.ok().build();
    }
}
