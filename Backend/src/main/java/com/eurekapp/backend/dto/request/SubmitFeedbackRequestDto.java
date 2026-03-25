package com.eurekapp.backend.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SubmitFeedbackRequestDto {
    private String organizationId;
    private String foundObjectUUID;     // nullable — null si wasFound=false
    @NotNull @Min(1) @Max(5)
    private Integer starRating;
    @NotNull
    private Boolean wasFound;
}
