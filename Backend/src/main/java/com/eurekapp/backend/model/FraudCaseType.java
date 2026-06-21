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
    CASE_3;

    /**
     * Rótulo en lenguaje llano que se muestra a personas (dueño de Eurekapp en las pantallas de
     * fraude y persona bloqueada en el mensaje de bloqueo). Nunca se expone "Caso 1/2/3": el número
     * es jerga interna. El front mantiene su propia copia de estos textos (EU-288).
     */
    public String getDisplayLabel() {
        return switch (this) {
            case CASE_1 -> "Retiros repetidos del mismo DNI";
            case CASE_2 -> "Posible acuerdo entre quien registra y quien retira";
            case CASE_3 -> "Posible complicidad de un empleado";
        };
    }

    /**
     * Convierte un motivo crudo ("CASE_1,CASE_3") a texto en lenguaje llano ("Retiros repetidos del
     * mismo DNI; Posible complicidad de un empleado"). Lo usan el reporte (CSV/PDF) y el mensaje de
     * bloqueo: nunca se expone el nombre técnico del caso.
     */
    public static String humanizeReason(String rawReason) {
        if (rawReason == null || rawReason.isBlank()) return "";
        return java.util.Arrays.stream(rawReason.split(","))
                .map(String::trim).filter(s -> !s.isEmpty())
                .map(s -> {
                    try { return FraudCaseType.valueOf(s).getDisplayLabel(); }
                    catch (IllegalArgumentException ex) { return s; }
                })
                .distinct()
                .collect(java.util.stream.Collectors.joining("; "));
    }
}
