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
public class AddEmployeeRequestListResponseDto {
    @JsonProperty("requests")
    private List<AddEmployeeRequestDto> requests;
}