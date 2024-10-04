package com.eurekapp.backend.model;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class LostObject {
    private String id;
    private String description;
    private String username;
    private List<Float> embeddings;
}
