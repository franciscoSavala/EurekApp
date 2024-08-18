package com.eurekapp.backend.exception;

import org.springframework.http.HttpStatus;

public class ForbbidenException extends ApiException {
    public ForbbidenException(String code, String description) {
        super(code, description, HttpStatus.FORBIDDEN);
    }
}
