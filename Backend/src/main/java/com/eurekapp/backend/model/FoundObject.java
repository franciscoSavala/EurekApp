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
    private String humanDescription;
    private String aiDescription;
    private String organizationId;
    private GeoCoordinates location;
    private Boolean wasReturned;
    private Float score;
}