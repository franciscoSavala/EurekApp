package com.eurekapp.backend.service.client;

import com.eurekapp.backend.dto.request.ClipImageRequest;
import com.eurekapp.backend.dto.request.ClipTextRequest;
import com.eurekapp.backend.dto.response.ClipEmbeddingResponse;
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
import java.util.Base64;
import java.util.List;

@Service
public class ClipModelEmbeddingService implements EmbeddingService {

    private static final Logger log = LoggerFactory.getLogger(OpenAiEmbeddingModelService.class);

    private final RestClient clipTextClient;
    private final RestClient clipImageClient;
    private final ObjectMapper objectMapper;

    public ClipModelEmbeddingService(@Qualifier("clipTextClient") RestClient clipTextClient,
                                     @Qualifier("clipImageClient") RestClient clipImageClient,
                                     ObjectMapper objectMapper) {
        this.clipTextClient = clipTextClient;
        this.objectMapper = objectMapper;
        this.clipImageClient = clipImageClient;
    }

    @SneakyThrows
    public List<Float> getTextVectorRepresentation(String text) {
        String requestBody = objectMapper.writeValueAsString(new ClipTextRequest(text));

        ResponseEntity<ClipEmbeddingResponse> embeddingResponse = clipTextClient.post()
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody)
                .retrieve()
                .toEntity(ClipEmbeddingResponse.class);

        String logMessage = String.format("[method:POST] [api_call:clip] Response=%s", objectMapper.writeValueAsString(embeddingResponse.getBody()));

        if(embeddingResponse.getStatusCode().is2xxSuccessful()){
            log.info(logMessage);
        }else{
            log.error(logMessage);
            throw new RuntimeException("Falló la call al descriptionService");
        }
        return embeddingResponse.getBody().getEmbedding();
    }

    @SneakyThrows
    public List<Float> getImageVectoRepresentation(byte[] image) {
        String base64Representation = Base64.getEncoder().encodeToString(image);
        String requestBody = objectMapper.writeValueAsString(new ClipImageRequest(base64Representation));

        ResponseEntity<ClipEmbeddingResponse> embeddingResponse = clipImageClient.post()
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody)
                .retrieve()
                .toEntity(ClipEmbeddingResponse.class);

        String logMessage = String.format("[method:POST] [api_call:clip] Response=%s", objectMapper.writeValueAsString(embeddingResponse.getBody()));

        if(embeddingResponse.getStatusCode().is2xxSuccessful()){
            log.info(logMessage);
        }else{
            log.error(logMessage);
            throw new RuntimeException("Falló la call al descriptionService");
        }

        return embeddingResponse.getBody().getEmbedding();
    }
}
