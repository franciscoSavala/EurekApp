package com.eurekapp.backend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LostObjectResponseDto {
    private String uuid;
    private String description;
    private LocalDateTime lostDate;
    private String organizationId;
    private String status;          // ACTIVE | CLOSED (EU-292)
    private LocalDateTime closedDate;
    private Boolean recovered;      // respuesta a "¿recuperaste tu objeto?" al cerrar (EU-292)
}
