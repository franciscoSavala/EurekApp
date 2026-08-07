package com.eurekapp.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

/**
 * Respuesta del microservicio CLIP (POST /classify): la categoría dura de una imagen.
 * Mapea el JSON {@code {"category": "BILLETERA", "confidence": 0.99, "scores": {...}}}.
 *
 * <p>{@code confidence} es la probabilidad de la categoría devuelta, en la escala del propio modelo
 * (softmax de los cosenos escalados por el {@code logit_scale} de CLIP). Sirve para MEDIR cuántas
 * clasificaciones reales son dudosas —insumo de EU-327—: el coseno crudo no es legible como
 * confianza, porque vive en una franja angosta (~0.20-0.36) por el modality gap. {@code scores}
 * (coseno crudo por categoría) queda como diagnóstico.</p>
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ClipClassificationResponse {
    private String category;
    private Float confidence;
    private Map<String, Float> scores;
}
