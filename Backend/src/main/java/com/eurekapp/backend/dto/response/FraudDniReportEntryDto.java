package com.eurekapp.backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Fila del reporte de fraude agrupado por DNI (EU-288). El modelo nuevo de fraude gira alrededor del
 * DNI de quien retira, y mucha de esa gente no tiene cuenta; por eso el reporte se puede pivotear por
 * DNI, sin nombre ni email.
 *
 * Mismos criterios que {@link FraudUserReportEntryDto}: conteos y motivos del rango pedido,
 * {@code historicalCount} acumulado para la reincidencia, e {@code incidents} con el historial
 * completo para el drill-down.
 */
@Data
@Builder
public class FraudDniReportEntryDto {
    private String dni;
    private long fraudCount;
    private long activeCount;
    private long falsePositiveCount;
    private long historicalCount;
    private List<String> reasons;
    private List<FraudAlertDto> incidents;
}
