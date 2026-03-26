package com.eurekapp.backend.dto.request;

import com.eurekapp.backend.model.FraudAlertStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ResolveFraudAlertRequestDto {
    @NotNull
    private FraudAlertStatus resolution;
}
