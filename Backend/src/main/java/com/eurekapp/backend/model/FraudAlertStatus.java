package com.eurekapp.backend.model;

/**
 * Estado de una alerta de fraude (modelo de 2 estados, EU-288).
 *
 * - ACTIVE: estado por defecto. La alerta nace activa y, al crearse, bloquea automáticamente al DNI
 *   y a los usuarios involucrados (EU-286). No hay paso previo de "revisión".
 * - FALSE_POSITIVE: el dueño de Eurekapp marcó la alerta como falsa alarma; eso levanta el bloqueo
 *   (EU-287). Es la única transición manual posible: no existe "confirmar fraude".
 */
public enum FraudAlertStatus {
    ACTIVE,
    FALSE_POSITIVE
}
