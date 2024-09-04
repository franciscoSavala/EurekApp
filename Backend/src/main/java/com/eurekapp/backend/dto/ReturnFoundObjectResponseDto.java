package com.eurekapp.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ReturnFoundObjectResponseDto {
    private String id;
    private String username;
    private String DNI;
    private String phoneNumber;
    private String foundObjectId;
    private String returnDateTime;
}
