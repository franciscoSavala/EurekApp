package com.eurekapp.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@NoArgsConstructor
@AllArgsConstructor
@Data
@Builder
public class FoundObjectDto {
    private String title;
    private String humanDescription;
    private String aiDescription;
    private String b64Json;
    private Float score;
    private String id;
    private OrganizationDto organization;
    @JsonProperty("found_date")
    private LocalDateTime foundDate;
    private Float latitude;
    private Float longitude;
    private Float distance;
}
