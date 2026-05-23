package com.eurekapp.backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class FraudAlertDto {
    private Long id;
    private String organizationId;
    private String foundObjectUUID;
    private String foundObjectTitle;
    private String foundObjectDescription;
    private String suspectUserEmail;
    private String suspectUserFullName;
    private List<FraudClaimantDto> relatedClaimants;
    private String reason;
    private String details;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime resolvedAt;
    private String resolvedByEmail;
}
