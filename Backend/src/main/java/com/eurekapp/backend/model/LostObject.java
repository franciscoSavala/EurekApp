package com.eurekapp.backend.model;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class LostObject {
    private String uuid;
    private String description;
    private String username;
    private LocalDateTime lostDate;
    private String organizationId;
    private GeoCoordinates coordinates;
    private List<Float> embeddings;
    private Float score;
    // Estado de la búsqueda guardada (EU-292). El cierre es LÓGICO: la búsqueda nunca se borra
    // de Weaviate, sólo pasa a CLOSED y deja de mostrarse como activa / de disparar avisos.
    private LostObjectStatus status;
    private LocalDateTime closedDate;
    // Respuesta del dueño al cerrar ("¿Recuperaste tu objeto? Sí/No"). Es un dato de la búsqueda,
    // NO un SearchFeedback (que es otra feature: calificar una búsqueda de objeto encontrado).
    private Boolean recovered;
}
