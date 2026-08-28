package com.eurekapp.backend.model;

/**
 * Datos con los que un aviso de coincidencia (MATCH_FOUND) puede llevar al usuario a la
 * coincidencia y mover el estado de su búsqueda.
 *
 * <p>Van juntos en un objeto y no como parámetros sueltos de {@code createNotification} porque son
 * un solo concepto —"esta coincidencia"— y porque la firma ya tiene bastantes argumentos
 * posicionales como para sumarle tres más del mismo tipo.</p>
 *
 * @param foundObjectUuid objeto encontrado que disparó el aviso.
 * @param lostObjectUuid  búsqueda guardada del usuario que mejor coincidió. Un aviso agrupa TODAS
 *                        sus búsquedas coincidentes, pero el objeto sólo puede ser de una: se toma
 *                        la de mayor puntaje.
 * @param score           puntaje de esa búsqueda, en escala de display (0-1). Es el número por el
 *                        que se le avisó al usuario, por eso se guarda y no se recalcula.
 */
public record MatchNotificationDetails(String foundObjectUuid, String lostObjectUuid, Double score) {
}
