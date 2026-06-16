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
    private String dni;
    private List<FraudUserDto> suspectUsers;
    private String returnedByEmployeeEmail;
    private String returnedByEmployeeFullName;
    private List<FraudCaseMatchDto> caseMatches;
    private String reason;
    private String details;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime resolvedAt;
    private String resolvedByEmail;
}
