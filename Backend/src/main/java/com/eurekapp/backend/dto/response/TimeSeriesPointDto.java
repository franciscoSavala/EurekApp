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
public class TimeSeriesPointDto {

    @JsonProperty("label")
    private String label;

    @JsonProperty("found_objects")
    private Long foundObjects;

    @JsonProperty("lost_objects")
    private Long lostObjects;

    @JsonProperty("returned_objects")
    private Long returnedObjects;
}
