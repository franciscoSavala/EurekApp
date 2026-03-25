package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.request.SubmitFeedbackRequestDto;
import com.eurekapp.backend.dto.response.FeedbackReportDto;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.service.FeedbackService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/feedback")
@CrossOrigin("*")
@Tag(name = "Feedback", description = "Feedback de los usuarios sobre la precisión de las coincidencias")
@SecurityRequirement(name = "bearerAuth")
public class FeedbackController {

    private final FeedbackService feedbackService;

    public FeedbackController(FeedbackService feedbackService) {
        this.feedbackService = feedbackService;
    }

    @PostMapping
    @Operation(summary = "Enviar feedback", description = "Registra el feedback del usuario sobre los resultados de una búsqueda.")
    public ResponseEntity<Void> submit(
            @AuthenticationPrincipal UserEurekapp user,
            @Valid @RequestBody SubmitFeedbackRequestDto dto) {
        feedbackService.submit(user, dto);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/report")
    @Operation(summary = "Obtener reporte de feedback", description = "Devuelve métricas agregadas de feedback. Solo accesible para ORGANIZATION_OWNER.")
    public ResponseEntity<FeedbackReportDto> getReport(
            @AuthenticationPrincipal UserEurekapp user,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false, defaultValue = "DAY") String groupBy) {
        LocalDate fromDate = from != null ? LocalDate.parse(from) : LocalDate.now().minusDays(30);
        LocalDate toDate = to != null ? LocalDate.parse(to) : LocalDate.now();
        return ResponseEntity.ok(feedbackService.getReport(user, fromDate, toDate, groupBy));
    }

    @GetMapping("/report/export")
    @Operation(summary = "Exportar reporte de feedback en CSV", description = "Descarga un CSV con todos los registros de feedback del período. Solo ORGANIZATION_OWNER.")
    public ResponseEntity<byte[]> exportCsv(
            @AuthenticationPrincipal UserEurekapp user,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        LocalDate fromDate = from != null ? LocalDate.parse(from) : LocalDate.now().minusDays(30);
        LocalDate toDate = to != null ? LocalDate.parse(to) : LocalDate.now();
        byte[] csv = feedbackService.exportCsv(user, fromDate, toDate);
        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=feedback-report.csv")
                .header("Content-Type", "text/csv; charset=UTF-8")
                .body(csv);
    }
}
