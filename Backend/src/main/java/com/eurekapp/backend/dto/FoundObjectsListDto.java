package com.eurekapp.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Data
@Builder
public class FoundObjectsListDto {
    @JsonProperty("found_objects")
    private List<FoundObjectDto> foundObjects;
    @JsonProperty("has_more")
    private Boolean hasMore;
    @JsonProperty("generated_description")
    private String generatedDescription;
    // EU-324: categoría dura que la IA clasificó a partir de la foto de la búsqueda. El front la
    // muestra read-only (decisión 8bis); si el usuario la ve mal, reintenta con otra foto.
    @JsonProperty("category")
    private String category;
}
