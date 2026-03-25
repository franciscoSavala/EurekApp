package com.eurekapp.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@NoArgsConstructor
@AllArgsConstructor
@Data
@Builder
public class FeedbackTimeSeriesPointDto {

    @JsonProperty("label")
    private String label;

    @JsonProperty("avg_rating")
    private Double avgRating;

    @JsonProperty("successful")
    private Long successful;

    @JsonProperty("unsuccessful")
    private Long unsuccessful;

    @JsonProperty("total")
    private Long total;
}
