package com.eurekapp.backend.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class LoginRequestDto {

    @NotBlank(message = "El correo electrónico es obligatorio.")
    @Email(message = "Debe ingresar un correo electrónico válido.")
    private String username;

    @NotBlank(message = "La contraseña es obligatoria.")
    @Size(min = 8, max = 16, message = "La contraseña debe tener entre 8 y 16 caracteres.")
    private String password;
}
