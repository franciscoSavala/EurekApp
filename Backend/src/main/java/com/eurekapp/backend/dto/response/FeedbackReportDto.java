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

    @JsonProperty("average_rating")
    private Double averageRating;

    @JsonProperty("total_feedback")
    private Long totalFeedback;

    @JsonProperty("successful_searches")
    private Long successfulSearches;

    @JsonProperty("unsuccessful_searches")
    private Long unsuccessfulSearches;

    @JsonProperty("star_distribution")
    private Map<Integer, Long> starDistribution;

    @JsonProperty("time_series")
    private List<FeedbackTimeSeriesPointDto> timeSeries;
}
