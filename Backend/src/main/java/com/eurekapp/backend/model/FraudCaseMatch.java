package com.eurekapp.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Un caso de fraude concreto que disparó dentro de una alerta, con la cantidad de devoluciones
 * detectada para ese caso ("cantidad detectada" que pide la story EU-277). Se persiste como fila de
 * la colección {@link FraudAlert#getCaseMatches()} en la tabla {@code fraud_alert_case}.
 */
@Embeddable
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FraudCaseMatch {

    @Enumerated(EnumType.STRING)
    @Column(name = "case_type", length = 20)
    private FraudCaseType caseType;

    @Column(name = "matched_count")
    private int matchedCount;
}
