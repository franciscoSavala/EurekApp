package com.eurekapp.backend.dto.response;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
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
    @JsonDeserialize(using = StrictDaysDeserializer.class)
    private Integer maxLostDateDays;
    private Boolean requiresIdentityValidation;
    private Boolean requiresAdditionalEvidence;
    private String additionalEvidenceDetails;
    private String organizationType;
    private List<OrganizationPolicyHistoryDto> history;
}
