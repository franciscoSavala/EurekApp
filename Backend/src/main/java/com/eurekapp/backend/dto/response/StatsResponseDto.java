package com.eurekapp.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@NoArgsConstructor
@AllArgsConstructor
@Data
@Builder
public class StatsResponseDto {

    @JsonProperty("Organizaciones")
    private Long organizations;

    @JsonProperty("Objetos encontrados")
    private Long foundObjects;

    @JsonProperty("Objetos devueltos")
    private Long returnedFoundObjects;

    @JsonProperty("Total usuarios")
    private Long users;

    @JsonProperty("Usuarios admin de organizaciones")
    private Long orgOwnerUsers;

    @JsonProperty("Usuarios empleados de organizaciones")
    private Long orgEmployeeUsers;

    @JsonProperty("Usuarios regulares")
    private Long regularUsers;
}
