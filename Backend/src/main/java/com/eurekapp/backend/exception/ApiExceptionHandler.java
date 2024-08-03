package com.eurekapp.backend.exception;

import io.jsonwebtoken.JwtException;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.List;

@ControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ApiError> notFoundExceptionHandler(Exception e){
        ApiError apiError = new ApiError("not_found", e.getMessage(), HttpStatus.NOT_FOUND.value());
        return ResponseEntity.status(apiError.getStatus()).body(apiError);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiError> valiadtionException(ConstraintViolationException e){
        List<String> messages = e.getConstraintViolations().stream()
                .map(ConstraintViolation::getMessage)
                .toList();
        ApiError apiError = new ApiError("bad_request", messages.getFirst(), HttpStatus.BAD_REQUEST.value());
        return ResponseEntity.status(apiError.getStatus()).body(apiError);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> maxUploadSizeException(Exception e){
        ApiError apiError = new ApiError("file_too_large", e.getMessage(), HttpStatus.PAYLOAD_TOO_LARGE.value());
        return ResponseEntity.status(apiError.getStatus()).body(apiError);
    }

    @ExceptionHandler(NotValidContentTypeException.class)
    public ResponseEntity<ApiError> notValidContentType(Exception e) {
        ApiError apiError = new ApiError("unrecognized_file_type", e.getMessage(), HttpStatus.UNSUPPORTED_MEDIA_TYPE.value());
        return ResponseEntity.status(apiError.getStatus()).body(apiError);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiError> badRequestException(Exception e) {
        ApiError apiError = new ApiError("not_valid_credentials", e.getMessage(), HttpStatus.BAD_REQUEST.value());
        return ResponseEntity.status(apiError.getStatus()).body(apiError);
    }

    @ExceptionHandler(JwtException.class)
    public ResponseEntity<ApiError> jwtNotValid(Exception e){
        ApiError apiError = new ApiError("invalid_jwt", e.getMessage(), HttpStatus.FORBIDDEN.value());
        return ResponseEntity.status(apiError.getStatus()).body(apiError);
    }
}
