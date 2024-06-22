package com.eurekapp.backend.exception;

public class NotValidContentTypeException extends RuntimeException {
    public NotValidContentTypeException(String message){
        super(message);
    }
}
