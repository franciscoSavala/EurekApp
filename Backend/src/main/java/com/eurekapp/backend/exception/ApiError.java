package com.eurekapp.backend.exception;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ApiError {
    private String error;
    private String message;
    private Integer status;
    private List<String> details;  // Para almacenar mensajes adicionales, si es necesario.
}
