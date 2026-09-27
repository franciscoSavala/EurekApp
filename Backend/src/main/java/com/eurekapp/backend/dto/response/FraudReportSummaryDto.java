package com.eurekapp.backend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Totales del reporte de fraude para el rango consultado (EU-392).
 *
 * Se calculan sobre la lista de alertas del período y no sumando las filas del reporte. Una fila es
 * una persona (o un DNI) y una alerta puede señalar a varias a la vez, así que sumar filas contaba
 * una misma alerta una vez por cada sospechoso. Del otro lado, las alertas que sólo disparan el
 * Caso 1 no señalan a nadie —los {@code suspects.add(...)} están únicamente en los Casos 2 y 3— y
 * por eso desaparecían del total.
 *
 * Como los dos errores tiran para lados opuestos, el número se veía razonable: con las alertas de
 * prueba daba 12 en vez de 11.
 */
@Data
@Builder
public class FraudReportSummaryDto {
    private long totalAlerts;
    private long activeCount;
    private long falsePositiveCount;

    /**
     * Las alertas del período, una vez cada una, con lo justo para dibujar el gráfico de evolución
     * (EU-227). El gráfico se armaba sumando el historial de cada fila y tenía los mismos dos
     * desvíos que los totales, además de ignorar el filtro de estado.
     */
    private List<PeriodAlert> periodAlerts;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PeriodAlert {
        private LocalDateTime createdAt;
        private String status;
    }
}
