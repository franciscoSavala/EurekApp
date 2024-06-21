package com.eurekapp.backend.service.client;


import com.eurekapp.backend.dto.request.EmbeddingRequest;
import com.eurekapp.backend.dto.response.ResponseEmbedding;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.SneakyThrows;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;

@Service
public class OpenAiEmbeddingModelService {

    private static final Logger log = LoggerFactory.getLogger(OpenAiEmbeddingModelService.class);

    @Qualifier("embeddingClient")
    private final RestClient embeddingClient;
    private final ObjectMapper objectMapper;

    public OpenAiEmbeddingModelService(RestClient embeddingClient, ObjectMapper objectMapper) {
        this.embeddingClient = embeddingClient;
        this.objectMapper = objectMapper;
    }

    @SneakyThrows
    public List<Float> getTextVectorRepresentation(String text){
        String requestBody = objectMapper.writeValueAsString(new EmbeddingRequest(text));
        ResponseEntity<ResponseEmbedding> embeddingResponse = embeddingClient.post()
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody)
                .retrieve()
                .toEntity(ResponseEmbedding.class);

        String logMessage = String.format("[method:POST] [api_call:openAiEmbeddings] Request=%s Response=%s", requestBody, "PII PROTECTED (?");
        if(embeddingResponse.getStatusCode().is2xxSuccessful()){
            log.info(logMessage);
        }else{
            log.error(logMessage);
            throw new RuntimeException("Falló la call a openAiEmbeddings");
        }

        return embeddingResponse.getBody().getData().getFirst().getEmbedding();
    }
}
