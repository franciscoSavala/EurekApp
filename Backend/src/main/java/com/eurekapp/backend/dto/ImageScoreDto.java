package com.eurekapp.backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@NoArgsConstructor
@AllArgsConstructor
@Data
@Builder
public class ImageScoreDto {
    private String textRepresentation;
    @JsonIgnore
    private String b64Json;
    private Float score;
    private String id;
}
