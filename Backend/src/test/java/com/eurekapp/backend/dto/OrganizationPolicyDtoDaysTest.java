package com.eurekapp.backend.dto;

import com.eurekapp.backend.dto.response.OrganizationPolicyDto;
import com.eurekapp.backend.dto.response.StrictDaysDeserializer;
import com.eurekapp.backend.exception.ApiError;
import com.eurekapp.backend.exception.Handler;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpInputMessage;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** EU-424: el plazo configurado solo admite enteros; decimales y texto salen como 400 con un mensaje claro. */
class OrganizationPolicyDtoDaysTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private ResponseEntity<ApiError> rechazo(String json) {
        JsonMappingException ex = assertThrows(JsonMappingException.class,
                () -> mapper.readValue(json, OrganizationPolicyDto.class));
        return new Handler().handleUnreadableBody(
                new HttpMessageNotReadableException("x", ex, (HttpInputMessage) null));
    }

    @Test
    void unDecimalSeRechazaConBadRequest() {
        ResponseEntity<ApiError> r = rechazo("{\"maxLostDateDays\":1.5}");
        assertEquals(400, r.getStatusCode().value());
        assertEquals(StrictDaysDeserializer.MENSAJE, r.getBody().getMessage());
    }

    @Test
    void unTextoSeRechazaConBadRequest() {
        ResponseEntity<ApiError> r = rechazo("{\"maxLostDateDays\":\"abc\"}");
        assertEquals(400, r.getStatusCode().value());
        assertEquals(StrictDaysDeserializer.MENSAJE, r.getBody().getMessage());
    }

    @Test
    void unEnteroSeAcepta() throws Exception {
        OrganizationPolicyDto dto = mapper.readValue("{\"maxLostDateDays\":30}", OrganizationPolicyDto.class);
        assertEquals(30, dto.getMaxLostDateDays());
    }
}
