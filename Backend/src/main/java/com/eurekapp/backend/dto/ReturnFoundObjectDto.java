package com.eurekapp.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ReturnFoundObjectDto {
    private String id;
    private String username;
    private String DNI;
    private String phoneNumber;
    private String personPhoto_b64Json;
    private String foundObjectId;
    private LocalDateTime returnDateTime;
}

