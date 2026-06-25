package com.eurekapp.backend.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FraudDetectionConfigDto {
    private int fraudThreshold;
    private int fraudWindowDays;
    private int blockDurationDays;
}
