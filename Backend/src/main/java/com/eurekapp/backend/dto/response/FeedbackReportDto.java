package com.eurekapp.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@NoArgsConstructor
@AllArgsConstructor
@Data
@Builder
public class FeedbackReportDto {

    /* EU-372/EU-375: el promedio unico y la distribucion de estrellas salian de la calificacion que
       se pedia en la pantalla de resultados, cuando la persona todavia no habia ido a retirar nada.
       Los reemplaza el promedio POR ASPECTO de las calificaciones posteriores a la devolucion: un
       promedio unico dice que algo anda mal, pero no que corregir. */
    @JsonProperty("aspect_averages")
    private Map<String, Double> aspectAverages;

    @JsonProperty("total_ratings")
    private Long totalRatings;

    @JsonProperty("comments")
    private List<OrganizationFeedbackCommentDto> comments;

    // Cuantas busquedas terminaron encontrando el objeto en esta organizacion. Se conserva.
    @JsonProperty("total_feedback")
    private Long totalFeedback;

    @JsonProperty("successful_searches")
    private Long successfulSearches;

    @JsonProperty("unsuccessful_searches")
    private Long unsuccessfulSearches;

    @JsonProperty("time_series")
    private List<FeedbackTimeSeriesPointDto> timeSeries;
}
