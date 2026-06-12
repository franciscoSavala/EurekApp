package com.eurekapp.backend.dto.request;

import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class UpdateFraudDetectionConfigRequest {

    @Min(value = 1, message = "El umbral de fraude (N) debe ser al menos 1")
    private int fraudThreshold;

    @Min(value = 1, message = "La ventana de fraude (T) debe ser al menos 1 día")
    private int fraudWindowDays;
}
