package com.eurekapp.backend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class OrganizationRequestSummaryDto {
    private Long id;
    private String organizationName;
    private String organizationType;
    private String city;
    private String ownerEmail;
    private String status;
    private LocalDateTime createdAt;
    private String requestingUserEmail;
}
