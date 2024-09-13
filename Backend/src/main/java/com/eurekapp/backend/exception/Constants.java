package com.eurekapp.backend.exception;

public class Constants {

    // Mensajes de error
    public static final String ERROR_INVALID_USERNAME = "El nombre de usuario no puede estar vacío.";
    public static final String ERROR_INVALID_PASSWORD = "La contraseña no puede estar vacía.";
    public static final String ERROR_INVALID_CREDENTIALS = "Usuario y/o contraseña incorrecta.";
    public static final String ERROR_USER_NOT_FOUND = "No se encontró el usuario con el username %s";
    public static final String ERROR_REPEATED_USER = "Ya existe un usuario con ese nombre de usuario";

    // Códigos de error
    public static final String CODE_INVALID_USERNAME = "invalid_username";
    public static final String CODE_INVALID_PASSWORD = "invalid_password";
    public static final String CODE_INVALID_CREDENTIALS = "invalid_credentials";
    public static final String CODE_USER_NOT_FOUND = "user_not_found";
    public static final String CODE_REPEATED_USER = "repeated_user";

    // Roles
    public static final String ROLE_USER = "ROLE_USER";
    public static final String ROLE_ADMIN = "ROLE_ADMIN";

    // Otros valores constantes
    public static final String DEFAULT_ORGANIZATION_NAME = "Default Organization";
}
