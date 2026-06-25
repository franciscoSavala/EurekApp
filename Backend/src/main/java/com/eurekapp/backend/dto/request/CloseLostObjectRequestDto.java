package com.eurekapp.backend.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * EU-292: cuerpo del cierre de una búsqueda guardada. {@code recovered} captura la respuesta al
 * prompt "¿Recuperaste tu objeto? Sí/No", que se guarda en la propia búsqueda (no es un feedback).
 */
@Data
public class CloseLostObjectRequestDto {
    @NotNull
    private Boolean recovered;
}
