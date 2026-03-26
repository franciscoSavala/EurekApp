package com.eurekapp.backend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrganizationPolicyDto {
    private Integer maxStorageDays;
    private Boolean requiresIdentityValidation;
    private String identityValidationDetails;
    private String deliveryProcess;
    private Boolean requiresAdditionalEvidence;
    private String additionalEvidenceDetails;
    private String strictControlCategories;
    private Boolean notifyOnMatch;
    private String rewardPolicy;
    private String organizationType;
    private List<OrganizationPolicyHistoryDto> history;
}
