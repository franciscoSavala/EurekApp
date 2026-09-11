package com.eurekapp.backend.exception;

import io.jsonwebtoken.JwtException;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.ErrorResponse;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.ArrayList;
import java.util.List;

@ControllerAdvice
public class Handler {

    private static final Logger log = LoggerFactory.getLogger(Handler.class);

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

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ApiError> handleForbiddenException(ForbiddenException e) {
        List<String> errorDetails = List.of(e.getMessage());
        ApiError apiError = ApiError.builder()
                .error(e.getError())
                .message(e.getMessage())
                .status(HttpStatus.FORBIDDEN.value())
                .details(errorDetails)
                .build();

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(apiError);
    }

    /**
     * EU-363: última red para cualquier excepción que no tenga un handler propio. Sin esto la
     * petición terminaba con un 200 de cuerpo vacío —una falla de base de datos, de conversión o de
     * integridad se veía como una operación exitosa— y ni el front ni el log se enteraban.
     *
     * <p>Las excepciones que Spring ya sabe traducir (método HTTP no soportado, recurso inexistente,
     * tipo de contenido inválido) conservan su propio código: sólo se les da el cuerpo común.</p>
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpectedException(Exception e) {
        HttpStatus status = e instanceof ErrorResponse errorResponse
                ? HttpStatus.valueOf(errorResponse.getStatusCode().value())
                : HttpStatus.INTERNAL_SERVER_ERROR;

        if (status.is5xxServerError()) {
            log.error("Excepción no contemplada", e);
        } else {
            log.warn("Petición rechazada: {}", e.getMessage());
        }

        ApiError apiError = ApiError.builder()
                .error(status.is5xxServerError() ? "internal_error" : "bad_request")
                .message(status.is5xxServerError()
                        ? "Ocurrió un error inesperado. Intentá de nuevo."
                        : "No se pudo procesar la petición.")
                .status(status.value())
                .details(List.of(e.getClass().getSimpleName()))
                .build();

        return ResponseEntity.status(status).body(apiError);
    }

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ApiError> handleNotFoundException(NotFoundException e) {
        List<String> errorDetails = List.of(e.getMessage());
        ApiError apiError = ApiError.builder()
                .error(e.getError())
                .message(e.getMessage())
                .status(HttpStatus.NOT_FOUND.value())
                .details(errorDetails)
                .build();

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(apiError);
    }
}
