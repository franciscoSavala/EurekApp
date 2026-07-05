package com.eurekapp.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * Respuesta del microservicio CLIP (POST /embed/image): el embedding visual de una imagen.
 * Mapea el JSON {@code {"model": "...", "dim": 512, "vector": [...]}}.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ClipEmbeddingResponse {
    private String model;
    private Integer dim;
    private List<Float> vector;
}
