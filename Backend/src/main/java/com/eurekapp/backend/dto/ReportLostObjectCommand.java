package com.eurekapp.backend.dto;

import com.eurekapp.backend.model.GeoCoordinates;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Getter
@Setter
@Data
@Builder
public class ReportLostObjectCommand {
    @JsonProperty("description")
    private String description;
    @JsonProperty("username")
    private String username;
    @JsonProperty("lost_date")
    private LocalDateTime lostDate;
    @JsonProperty("coordinates")
    private GeoCoordinates geoCoordinates;
    @JsonProperty("organization_id")
    private String organizationId;
}
