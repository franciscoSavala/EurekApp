package com.eurekapp.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

/**
 * EU-374: lo que la pantalla de la encuesta necesita saber antes de mostrarse. Si la devolucion ya
 * fue calificada se le avisa a la persona en lugar de dejarla responder de nuevo.
 */
@Data
@Builder
public class OrganizationFeedbackSurveyDto {

    @JsonProperty("organization_name")
    private String organizationName;

    @JsonProperty("object_title")
    private String objectTitle;

    @JsonProperty("already_rated")
    private Boolean alreadyRated;
}
