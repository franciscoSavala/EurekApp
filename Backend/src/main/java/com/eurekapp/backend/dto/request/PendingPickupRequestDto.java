package com.eurekapp.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Cuerpo del paso a "Por retirar": cuál de los objetos encontrados reconoció el usuario como suyo.
 * Se guarda en la búsqueda para poder mostrarle después dónde ir a retirarlo.
 */
@Data
public class PendingPickupRequestDto {
    @NotBlank
    private String foundObjectUuid;
}
