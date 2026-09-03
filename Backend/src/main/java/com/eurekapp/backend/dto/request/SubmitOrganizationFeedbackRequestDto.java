package com.eurekapp.backend.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * EU-371: los cinco aspectos con los que se califica la atencion de una organizacion despues de
 * retirar un objeto. Todos obligatorios de 1 a 5; el comentario es libre y opcional.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubmitOrganizationFeedbackRequestDto {

    @NotNull @Min(1) @Max(5)
    private Integer staffTreatment;

    @NotNull @Min(1) @Max(5)
    private Integer waitingTime;

    @NotNull @Min(1) @Max(5)
    private Integer instructionsClarity;

    @NotNull @Min(1) @Max(5)
    private Integer objectCondition;

    @NotNull @Min(1) @Max(5)
    private Integer pickupSecurity;

    @Size(max = 500)
    private String comment;
}
