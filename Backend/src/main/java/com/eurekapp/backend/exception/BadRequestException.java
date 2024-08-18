package com.eurekapp.backend.exception;

import org.springframework.http.HttpStatus;

public class BadRequestException extends ApiException {

    public BadRequestException(String code, String description) {
        super(code, description, HttpStatus.BAD_REQUEST);
    }

    public BadRequestException(ValidationError validationError){
        super(validationError.getCode(), validationError.getError(), HttpStatus.BAD_REQUEST);
    }
}
