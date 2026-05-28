package com.eurekapp.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class UsabilityFeedbackReportDto {

    @JsonProperty("average_rating")
    private Double averageRating;

    @JsonProperty("total_feedback")
    private Long totalFeedback;

    @JsonProperty("star_distribution")
    private Map<Integer, Long> starDistribution;

    @JsonProperty("aspect_distribution")
    private Map<String, Long> aspectDistribution;

    @JsonProperty("time_series")
    private List<UsabilityTimeSeriesPointDto> timeSeries;
}
