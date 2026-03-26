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
public class ReclamoHistoryDto {
    private Long id;
    private String previousStatus;
    private String newStatus;
    private String changedByEmail;
    private LocalDateTime changedAt;
    private String note;
}
