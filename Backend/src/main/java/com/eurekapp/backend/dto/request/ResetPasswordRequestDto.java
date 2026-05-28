package com.eurekapp.backend.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ResetPasswordRequestDto {

    @NotBlank
    @Email
    private String email;

    @NotBlank
    private String token;

    @NotBlank
    @Size(min = 8, message = "La contraseña debe tener al menos 8 caracteres.")
    private String newPassword;
}
