package com.eurekapp.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class UsabilityFeedbackRecordDto {

    @JsonProperty("id")
    private Long id;

    @JsonProperty("star_rating")
    private Integer starRating;

    @JsonProperty("aspects")
    private List<String> aspects;

    @JsonProperty("comment")
    private String comment;

    @JsonProperty("context")
    private String context;

    @JsonProperty("created_at")
    private LocalDateTime createdAt;
}
