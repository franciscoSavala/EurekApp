package com.eurekapp.backend.model;

/**
 * Estado de una búsqueda guardada ({@link LostObject}), introducido en EU-292.
 *
 * <p>El cierre es LÓGICO: la búsqueda nunca se borra de Weaviate. Una búsqueda {@code CLOSED}
 * deja de aparecer como activa y deja de disparar avisos de coincidencia, pero el usuario la
 * sigue viendo en su historial. Es un estado terminal: no se reabre (se crea una nueva).</p>
 */
public enum LostObjectStatus {
    ACTIVE,
    CLOSED
}
