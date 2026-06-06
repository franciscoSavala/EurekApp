package com.eurekapp.backend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AdminOrganizationDto {
    private Long id;
    private String name;
    private String contactData;
    private String city;
    private String province;
    private String organizationType;
    private boolean active;
    private int employeeCount;
}
