package com.eurekapp.backend.dto.response;

import lombok.Builder;
import lombok.Data;

/**
 * Un caso de fraude disparado dentro de una alerta, con su cantidad detectada. Espejo de
 * {@code FraudCaseMatch} para exponerlo en el detalle/listado de alertas (consumido por EU-288).
 */
@Data
@Builder
public class FraudCaseMatchDto {
    private String caseType;
    private int matchedCount;
}
