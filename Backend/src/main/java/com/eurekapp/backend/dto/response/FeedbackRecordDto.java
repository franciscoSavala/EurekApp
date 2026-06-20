package com.eurekapp.backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class FeedbackRecordDto {
    private Long id;
    private String organizationId;
    private String foundObjectUUID;
    private String foundObjectTitle;
    private String foundObjectDescription;
    private Integer starRating;
    private Boolean wasFound;
    private LocalDateTime createdAt;
    private String comment;
}