package com.eurekapp.backend.exception;

import io.jsonwebtoken.JwtException;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.ArrayList;
import java.util.List;

@ControllerAdvice
public class Handler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ResponseEntity<ApiError> handleValidationExceptions(MethodArgumentNotValidException ex) {
        // Lista para almacenar los detalles de los errores de campo
        List<String> errorDetails = new ArrayList<>();
        ex.getBindingResult().getFieldErrors().forEach(error ->
                errorDetails.add("Error en campo '" + error.getField() + "': " + error.getDefaultMessage())
        );

        // Crear el objeto ApiError con el formato deseado
        ApiError apiError = ApiError.builder()
                .error("bad_request")
                .message("Error en los datos enviados")
                .status(HttpStatus.BAD_REQUEST.value())
                .details(errorDetails)
                .build();

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(apiError);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiError> validationException(ConstraintViolationException e) {
        List<String> errorDetails = new ArrayList<>();
        e.getConstraintViolations().forEach(violation ->
                errorDetails.add(violation.getMessage())
        );
        ApiError apiError = ApiError.builder()
                .error("bad_request")
                .message("Violación de restricción en los datos enviados")
                .status(HttpStatus.BAD_REQUEST.value())
                .details(errorDetails)
                .build();

        return ResponseEntity.status(apiError.getStatus()).body(apiError);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> maxUploadSizeException(Exception e) {
        List<String> errorDetails = List.of(e.getMessage());
        ApiError apiError = ApiError.builder()
                .error("file_too_large")
                .message("El archivo subido excede el tamaño máximo permitido")
                .status(HttpStatus.PAYLOAD_TOO_LARGE.value())
                .details(errorDetails)
                .build();

        return ResponseEntity.status(apiError.getStatus()).body(apiError);
    }

    @ExceptionHandler(JwtException.class)
    public ResponseEntity<ApiError> jwtNotValid(Exception e) {
        List<String> errorDetails = List.of(e.getMessage());
        ApiError apiError = ApiError.builder()
                .error("invalid_jwt")
                .message("Token JWT inválido")
                .status(HttpStatus.FORBIDDEN.value())
                .details(errorDetails)
                .build();

        return ResponseEntity.status(apiError.getStatus()).body(apiError);
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> apiException(ApiException e) {
        List<String> errorDetails = List.of(e.getMessage());
        ApiError apiError = ApiError.builder()
                .error(e.getError())
                .message(e.getMessage())
                .status(e.getStatusCode().value())
                .details(errorDetails)
                .build();

        return ResponseEntity.status(apiError.getStatus()).body(apiError);
    }

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<ApiError> handleBadRequestException(BadRequestException e) {
        List<String> errorDetails = List.of(e.getMessage());
        ApiError apiError = ApiError.builder()
                .error(e.getError())
                .message(e.getMessage())
                .status(HttpStatus.BAD_REQUEST.value())
                .details(errorDetails)
                .build();

        return ResponseEntity.status(apiError.getStatus()).body(apiError);
    }
}
