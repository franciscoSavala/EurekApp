package com.eurekapp.backend.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FraudClaimantDto {
    private Long userId;
    private String email;
    private String fullName;
}
