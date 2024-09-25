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
public class OpenAiEmbeddingModelService implements EmbeddingService {

    private static final Logger log = LoggerFactory.getLogger(OpenAiEmbeddingModelService.class);

    @Qualifier("embeddingClient")
    private final RestClient embeddingClient;
    private final ObjectMapper objectMapper;

    public OpenAiEmbeddingModelService(RestClient embeddingClient, ObjectMapper objectMapper) {
        this.embeddingClient = embeddingClient;
        this.objectMapper = objectMapper;
    }

    /* Este método toma un texto (en nuestra app, siempre será la descripción textual de una foto), lo envía a la API
    *    de Open AI Embeddings, y recibe de la misma una representación vectorial de dicho texto. */
    @SneakyThrows
    public List<Float> getTextVectorRepresentation(String text){

        // Esta línea arma el JSON que enviaremos en la request a la API de Open AI Embeddings.
        String requestBody = objectMapper.writeValueAsString(new EmbeddingRequest(text));

        // Enviamos la request, y guardamos la respuesta de la API en la variable "embeddingResponse".
        ResponseEntity<ResponseEmbedding> embeddingResponse = embeddingClient.post()
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody)
                .retrieve()
                .toEntity(ResponseEmbedding.class);

        // Armamos el mensaje que se asentará en el log.
        String logMessage = String.format("[method:POST] [api_call:openAiEmbeddings] Request=%s Response=%s", requestBody, "PII PROTECTED (?");

        // Si la request fue exitosa, guardamos el mensaje en e log. Sino, lanzamos una excepción.
        if(embeddingResponse.getStatusCode().is2xxSuccessful()){
            log.info(logMessage);
        }else{
            log.error(logMessage);
            throw new RuntimeException("Falló la call a openAiEmbeddings");
        }

        // Finalmente, si no se lanzó una excepión, devolvemos el vector que representa al texto que pasamos como
        //  parámetro inicialmente.
        return embeddingResponse.getBody().getData().getFirst().getEmbedding();
    }

    @Override
    public List<Float> getImageVectoRepresentation(byte[] image) {
        log.error("This method is not allowed!");
        return List.of();
    }
}
