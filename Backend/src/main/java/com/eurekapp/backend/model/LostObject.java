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
    // EU-323: dos vectores nombrados por objeto (ver FoundObject). Cualquiera puede ser null.
    private List<Float> imageEmbedding;
    private List<Float> textEmbedding;
    // EU-323: categoría dura (definida por IA desde la imagen). Filtro previo del matching.
    private String category;
    private Float score;
    // EU-324: certezas coseno crudas por modalidad, expuestas por la búsqueda combinada (queryDual).
    // Cada una puede ser null si el candidato no matcheó por esa modalidad (o no se consultó).
    // Alimentan a SearchScoringService.combinedScore; NO se persisten.
    private Float imageCertainty;
    private Float textCertainty;
    // Estado de la búsqueda guardada (EU-292). El cierre es LÓGICO: la búsqueda nunca se borra
    // de Weaviate, sólo pasa a CLOSED y deja de mostrarse como activa / de disparar avisos.
    private LostObjectStatus status;
    private LocalDateTime closedDate;
    // Respuesta del dueño al cerrar ("¿Recuperaste tu objeto? Sí/No"). Es un dato de la búsqueda,
    // NO un SearchFeedback (que es otra feature: calificar una búsqueda de objeto encontrado).
    private Boolean recovered;
}
