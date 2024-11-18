package com.eurekapp.backend.model;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;


@Data
@Builder
public class FoundObject {
    private String uuid;
    private List<Float> embeddings;
    private LocalDateTime foundDate;
    private String title;
    private UserEurekapp objectFinderUser;
    private String humanDescription;
    private String aiDescription;
    private String organizationId;
    private GeoCoordinates coordinates;
    private Boolean wasReturned;

    //Estos dos atributos son usados sólo cuando se hace una búsqueda.
    private Float score;
    private Float distance;
}