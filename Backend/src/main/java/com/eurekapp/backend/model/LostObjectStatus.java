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
    /**
     * El usuario reconoció un objeto encontrado como suyo y lo va a retirar de la organización que
     * lo tiene ("Por retirar"). A diferencia de {@link #CLOSED} NO es terminal: si al verlo en
     * persona resulta que no era el suyo, vuelve a {@link #ACTIVE} y la búsqueda sigue viva.
     *
     * <p>Una búsqueda en este estado sigue recibiendo avisos de coincidencia: el objeto que la puso
     * acá puede no ser el correcto, que es justamente el caso que contempla la vuelta atrás.</p>
     */
    PENDING_PICKUP,
    CLOSED
}
