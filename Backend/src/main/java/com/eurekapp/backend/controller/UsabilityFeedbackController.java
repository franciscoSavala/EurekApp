package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.request.SubmitUsabilityFeedbackRequestDto;
import com.eurekapp.backend.dto.response.UsabilityFeedbackRecordDto;
import com.eurekapp.backend.dto.response.UsabilityFeedbackReportDto;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.service.UsabilityFeedbackService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

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

    @GetMapping("/report")
    @Operation(summary = "Obtener reporte de feedback de usabilidad", description = "Devuelve métricas agregadas de usabilidad. Solo accesible para ORGANIZATION_OWNER.")
    public ResponseEntity<UsabilityFeedbackReportDto> getReport(
            @AuthenticationPrincipal UserEurekapp user,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false, defaultValue = "DAY") String groupBy) {
        LocalDate fromDate = from != null ? LocalDate.parse(from) : LocalDate.now().minusDays(30);
        LocalDate toDate = to != null ? LocalDate.parse(to) : LocalDate.now();
        return ResponseEntity.ok(service.getReport(user, fromDate, toDate, groupBy));
    }

    @GetMapping("/records")
    @Operation(summary = "Obtener registros de feedback de usabilidad", description = "Devuelve registros individuales sin datos personales. Solo ORGANIZATION_OWNER.")
    public ResponseEntity<List<UsabilityFeedbackRecordDto>> getRecords(
            @AuthenticationPrincipal UserEurekapp user,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        LocalDate fromDate = from != null ? LocalDate.parse(from) : LocalDate.now().minusDays(30);
        LocalDate toDate = to != null ? LocalDate.parse(to) : LocalDate.now();
        return ResponseEntity.ok(service.getRecords(user, fromDate, toDate));
    }

    @GetMapping("/report/export")
    @Operation(summary = "Exportar reporte de usabilidad en CSV", description = "Descarga un CSV con registros de usabilidad sin datos personales. Solo ORGANIZATION_OWNER.")
    public ResponseEntity<byte[]> exportCsv(
            @AuthenticationPrincipal UserEurekapp user,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        LocalDate fromDate = from != null ? LocalDate.parse(from) : LocalDate.now().minusDays(30);
        LocalDate toDate = to != null ? LocalDate.parse(to) : LocalDate.now();
        byte[] csv = service.exportCsv(user, fromDate, toDate);
        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=usability-feedback-report.csv")
                .header("Content-Type", "text/csv; charset=UTF-8")
                .body(csv);
    }
}
