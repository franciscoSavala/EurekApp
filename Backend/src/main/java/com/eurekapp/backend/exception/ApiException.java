package com.eurekapp.backend.exception;

import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {

    private final String error;
    private final HttpStatus statusCode;

    /**
     * Constructor with default status error = 500
     *
     * @param error   the error code of the exception
     * @param message the message to return the user
     */
    public ApiException(String error, String message) {
        super(message);
        this.error = error;
        statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    }

    /**
     * @param error      the error code of the exception
     * @param message    the message to return the user
     * @param statusCode the API status error code
     */
    public ApiException(String error, String message, HttpStatus statusCode) {
        super(message);
        this.error = error;
        this.statusCode = statusCode;
    }

    /**
     * @param error      the error code of the exception
     * @param message    the message to return the user
     * @param cause      root exception
     */
    public ApiException(String error, String message, Throwable cause) {
        super(message, cause);
        this.error = error;
        statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    }

    public String getError() {
        return error;
    }

    public HttpStatus getStatusCode() {
        return statusCode;
    }
}
