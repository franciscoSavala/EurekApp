package com.eurekapp.backend.exception;

import lombok.Getter;

@Getter
public enum ValidationError {

    INVALID_EMAIL("invalid_email", "El correo no puede estar vacío."),
    INVALID_PASSWORD("invalid_password", "La contraseña no puede estar vacía."),
    INVALID_CREDENTIALS("invalid_credentials", "Usuario y/o contraseña incorrecta."),
    USER_NOT_FOUND("user_not_found", "No se encontró el usuario con el username %s"),
    REPEATED_EMAIL("repeated_email", "Ya existe un usuario con ese correo"),
    FOUND_DATE_ERROR("found_date_error", "The date must be before system date");

    private final String code;
    private final String error;

    ValidationError(String code, String error) {
        this.code = code;
        this.error = error;
    }
}
