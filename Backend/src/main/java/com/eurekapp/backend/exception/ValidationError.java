package com.eurekapp.backend.exception;

import lombok.Getter;

@Getter
public enum ValidationError {
    FOUND_DATE_ERROR("found_date_error", "The date must be before system date");
    private final String code;
    private final String error;

    ValidationError(String code, String error) {
        this.code = code;
        this.error = error;
    }
}
