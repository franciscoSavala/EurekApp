package com.eurekapp.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * EU-375: un comentario libre dejado al calificar la atencion. Sin datos de quien lo escribio: al
 * responsable de organizacion le sirve para saber que corregir, no quien se quejo.
 */
@Data
@Builder
public class OrganizationFeedbackCommentDto {

    @JsonProperty("comment")
    private String comment;

    @JsonProperty("created_at")
    private LocalDateTime createdAt;
}
