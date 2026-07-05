package com.eurekapp.backend.model;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;


@Data
@Builder
public class FoundObject {
    private String uuid;
    // EU-323: dos vectores nombrados por objeto. "image" (CLIP, foto) y "text" (OpenAI, título+descripción).
    // Cualquiera puede ser null (p. ej. una búsqueda sin foto); el repositorio persiste sólo los presentes.
    private List<Float> imageEmbedding;
    private List<Float> textEmbedding;
    private LocalDateTime foundDate;
    private String title;
    private UserEurekapp objectFinderUser;
    private String humanDescription;
    private String organizationId;
    private GeoCoordinates coordinates;
    private Boolean wasReturned;

    private String category;

    //Estos dos atributos son usados sólo cuando se hace una búsqueda.
    private Float score;
    private Float distance;
}