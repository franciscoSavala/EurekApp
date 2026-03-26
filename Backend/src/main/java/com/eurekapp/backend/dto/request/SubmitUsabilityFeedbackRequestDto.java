package com.eurekapp.backend.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class SubmitUsabilityFeedbackRequestDto {
    @NotNull @Min(1) @Max(5)
    private Integer starRating;
    private List<String> aspects;   // nullable — aspectos seleccionados
    @Size(max = 500)
    private String comment;         // nullable
    @Size(max = 100)
    private String context;         // nullable — pantalla/acción donde se originó
}
