package com.eurekapp.backend.dto.response;

import lombok.Builder;
import lombok.Data;

// Persona referenciada por una alerta de fraude (sospechoso a bloquear).
@Data
@Builder
public class FraudUserDto {
    private Long userId;
    private String email;
    private String fullName;
}
