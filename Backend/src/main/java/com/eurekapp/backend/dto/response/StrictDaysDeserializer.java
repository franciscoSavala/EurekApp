package com.eurekapp.backend.dto.response;

import com.eurekapp.backend.exception.BadRequestException;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;

import java.io.IOException;

/** Acepta solo enteros (o null); rechaza decimales y texto con un 400 claro (EU-424). */
public class StrictDaysDeserializer extends JsonDeserializer<Integer> {

    public static final String MENSAJE = "El plazo debe ser un número entero de días mayor a cero.";

    @Override
    public Integer deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
        if (p.currentToken() == JsonToken.VALUE_NUMBER_INT) {
            long value = p.getLongValue();
            if (value > Integer.MAX_VALUE || value < Integer.MIN_VALUE) {
                throw new BadRequestException("max_lost_date_days_invalid", MENSAJE);
            }
            return (int) value;
        }
        throw new BadRequestException("max_lost_date_days_invalid", MENSAJE);
    }
}
