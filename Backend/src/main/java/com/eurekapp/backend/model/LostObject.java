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
}
