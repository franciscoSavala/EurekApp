package com.eurekapp.backend.dto.request;

import com.eurekapp.backend.model.OrganizationRequestStatus;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ResolveOrganizationRequestDto {

    @NotNull(message = "La resolución es obligatoria.")
    private OrganizationRequestStatus resolution;

    private String adminNote;
}
