package com.eurekapp.backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class FraudUserReportEntryDto {
    private Long userId;
    private String email;
    private String fullName;
    private long fraudCount;
    private long confirmedFraudCount;
    private long pendingCount;
    private List<String> reasons;
    private List<FraudAlertDto> incidents;
}
