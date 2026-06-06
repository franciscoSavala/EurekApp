package com.eurekapp.backend.dto.request;

import com.eurekapp.backend.model.OrganizationType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class OrganizationRegistrationRequestDto {

    @NotBlank(message = "El nombre de la organización es obligatorio.")
    private String organizationName;

    @NotNull(message = "El tipo de organización es obligatorio.")
    private OrganizationType organizationType;

    private String customOrganizationType;

    @NotBlank(message = "La calle es obligatoria.")
    private String street;

    @NotBlank(message = "La altura es obligatoria.")
    private String streetNumber;

    @NotBlank(message = "La ciudad es obligatoria.")
    private String city;

    @NotBlank(message = "La provincia es obligatoria.")
    private String province;

    @NotBlank(message = "El país es obligatorio.")
    private String country;

    @NotNull(message = "La latitud es obligatoria.")
    private Double latitude;

    @NotNull(message = "La longitud es obligatoria.")
    private Double longitude;

    @NotBlank(message = "El nombre del responsable es obligatorio.")
    private String ownerFirstName;

    @NotBlank(message = "El apellido del responsable es obligatorio.")
    private String ownerLastName;

    @NotBlank(message = "El correo electrónico del responsable es obligatorio.")
    @Email(message = "El correo electrónico del responsable debe ser válido.")
    private String ownerEmail;

    @NotBlank(message = "El teléfono del responsable es obligatorio.")
    private String ownerPhone;

    @NotBlank(message = "El motivo de la solicitud es obligatorio.")
    private String reason;
}
