package com.eurekapp.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UsabilityTimeSeriesPointDto {

    @JsonProperty("label")
    private String label;

    @JsonProperty("avg_rating")
    private Double avgRating;

    @JsonProperty("total")
    private Long total;
}
