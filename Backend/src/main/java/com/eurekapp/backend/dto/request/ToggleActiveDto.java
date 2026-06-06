package com.eurekapp.backend.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ToggleActiveDto {
    @NotNull(message = "El campo 'active' es obligatorio.")
    private Boolean active;
}
