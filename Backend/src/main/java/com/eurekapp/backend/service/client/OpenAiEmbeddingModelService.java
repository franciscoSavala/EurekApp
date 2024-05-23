package com.eurekapp.backend.service.client;


import com.eurekapp.backend.model.response.ResponseEmbedding;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;

@Service
public class OpenAiEmbeddingModelService {

    private static final Logger log = LoggerFactory.getLogger(OpenAiEmbeddingModelService.class);

    @Qualifier("embeddingClient")
    private final RestClient embeddingClient;

    public OpenAiEmbeddingModelService( RestClient embeddingClient) {
        this.embeddingClient = embeddingClient;
    }

    public List<Float> getEmbedding(String text){
        ResponseEmbedding embedding = embeddingClient.post()
                .contentType(MediaType.APPLICATION_JSON)
                .body(String.format("{\"model\":\"text-embedding-3-small\",\"input\":\"%s\"}",text))
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, (request, response) -> {
                    log.error(response.getBody().toString());
                    throw new RuntimeException("No se pudo conectar con la app!!");
                })
                .body(ResponseEmbedding.class);
        return embedding.getData().getFirst().getEmbedding();
    }
}
