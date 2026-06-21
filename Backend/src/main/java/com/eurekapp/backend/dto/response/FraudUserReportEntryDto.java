package com.eurekapp.backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Fila del reporte de fraude agrupado por usuario registrado (EU-288).
 *
 * Los conteos {@code fraudCount}/{@code activeCount}/{@code falsePositiveCount} y {@code reasons}
 * son del rango de fechas pedido (lo que el dueño de Eurekapp consultó). {@code historicalCount} es
 * el acumulado de TODA la historia del usuario: alimenta la marca de reincidencia, sin contaminar
 * los números del rango. {@code incidents} trae el historial completo; el front muestra por defecto
 * los del rango y deja el resto en un drill-down.
 */
@Data
@Builder
public class FraudUserReportEntryDto {
    private Long userId;
    private String email;
    private String fullName;
    private long fraudCount;
    private long activeCount;
    private long falsePositiveCount;
    private long historicalCount;
    private List<String> reasons;
    private List<FraudAlertDto> incidents;
}
