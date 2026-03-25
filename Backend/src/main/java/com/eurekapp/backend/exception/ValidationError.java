package com.eurekapp.backend.exception;

import lombok.Getter;

@Getter
public enum ValidationError {

    INVALID_EMAIL("invalid_email", "El correo no puede estar vacío."),
    INVALID_PASSWORD("invalid_password", "La contraseña no puede estar vacía."),
    INVALID_CREDENTIALS("invalid_credentials", "Usuario y/o contraseña incorrecta."),
    USER_NOT_FOUND("user_not_found", "No se encontró el usuario con el username %s"),
    REPEATED_EMAIL("repeated_email", "Ya existe un usuario con ese correo"),
    FOUND_DATE_ERROR("found_date_error", "The date must be before system date"),
    INVALID_SOCIAL_TOKEN("invalid_social_token", "El token del proveedor social es inválido o expiró."),
    MISSING_SOCIAL_EMAIL("missing_social_email", "El proveedor social no proporcionó un email.");

    private final String code;
    private final String error;

    ValidationError(String code, String error) {
        this.code = code;
        this.error = error;
    }
}
