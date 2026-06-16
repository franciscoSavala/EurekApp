package com.eurekapp.backend.model;

/**
 * Tipos de caso de fraude sobre devoluciones (EU-284). Una misma alerta puede registrar varios a
 * la vez (ver {@link FraudAlert#getCaseMatches()}). Para sumar un tipo de fraude nuevo en el futuro
 * basta con agregar una constante acá: la tabla hija {@code fraud_alert_case} lo absorbe sin migración.
 *
 * - CASE_1: agrupa devoluciones por DNI de quien retira.
 * - CASE_2: agrupa por par (object finder, DNI), solo devoluciones con finder no nulo.
 * - CASE_3: agrupa por par (empleado que entrega, DNI).
 */
public enum FraudCaseType {
    CASE_1,
    CASE_2,
    CASE_3
}
