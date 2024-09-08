package com.eurekapp.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Data
@Builder
public class ReportLostObjectCommand {
    @JsonProperty("description")
    private String description;
    @JsonProperty("username")
    private String username;

}
