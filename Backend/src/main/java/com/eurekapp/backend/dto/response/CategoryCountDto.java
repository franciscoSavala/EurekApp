package com.eurekapp.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;

@Builder
public record CategoryCountDto(
        @JsonProperty("category") String category,
        @JsonProperty("count") Long count
) {}
