package com.eurekapp.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Data
@Builder
public class ReportsResponseDto {

    @JsonProperty("found_objects")
    private Long foundObjects;

    @JsonProperty("lost_objects")
    private Long lostObjects;

    @JsonProperty("returned_objects")
    private Long returnedObjects;

    @JsonProperty("active_users")
    private Long activeUsers;

    @JsonProperty("time_series")
    private List<TimeSeriesPointDto> timeSeries;
}
