package com.eurekapp.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InAppNotificationDto {

    private Long id;
    private String title;
    private String description;
    private String type;

    @JsonProperty("is_read")
    private boolean read;

    @JsonProperty("created_at")
    private LocalDateTime createdAt;

    @JsonProperty("related_request_id")
    private Long relatedRequestId;

    // EU-345: presentes sólo en los avisos MATCH_FOUND; son los que permiten abrir la coincidencia.
    @JsonProperty("related_object_uuid")
    private String relatedObjectUuid;

    @JsonProperty("match_score")
    private Double matchScore;
}
