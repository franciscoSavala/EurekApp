package com.eurekapp.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

/**
 * Respuesta del microservicio CLIP (POST /classify): la categoría dura de una imagen.
 * Mapea el JSON {@code {"category": "BILLETERA", "scores": {"BILLETERA": 0.34, ...}}}.
 * {@code scores} (mejor similitud por categoría) es informativo/diagnóstico.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ClipClassificationResponse {
    private String category;
    private Map<String, Float> scores;
}
