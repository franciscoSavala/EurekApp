package com.eurekapp.backend.exception;

import org.springframework.http.HttpStatus;

public class ForbiddenException extends ApiException {
    public ForbiddenException(String code, String description) {
        super(code, description, HttpStatus.FORBIDDEN);
    }
}
