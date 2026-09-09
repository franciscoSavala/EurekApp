package com.eurekapp.backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Respuesta del reporte de fraude (EU-392): los totales del período y las filas de la agrupación
 * pedida, por usuario o por DNI.
 *
 * Los totales viajan aparte porque no se pueden derivar de las filas: una alerta puede aparecer en
 * varias o en ninguna, según a cuántas personas señale. Al calcularse una sola vez sobre las alertas
 * del rango, las dos agrupaciones devuelven el mismo resumen.
 */
@Data
@Builder
public class FraudReportResponseDto<T> {
    private FraudReportSummaryDto summary;
    private List<T> entries;
}
