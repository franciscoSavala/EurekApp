package com.eurekapp.backend.service.client;


import com.eurekapp.backend.model.response.ResponseEmbedding;
import lombok.Builder;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;

@Service
public class OpenAiEmbeddingModelService {

    private static final Logger log = LoggerFactory.getLogger(OpenAiEmbeddingModelService.class);
    @Qualifier("openAiRestClient")
    private final RestClient restClient;

    public OpenAiEmbeddingModelService(RestClient restClient) {
        this.restClient = restClient;
    }

    public List<Float> getEmbedding(String text){
        ResponseEmbedding embedding = restClient.post()
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
