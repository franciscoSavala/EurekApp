package com.eurekapp.backend.service.client;

import com.eurekapp.backend.dto.request.ChatCompletionRequest;
import com.eurekapp.backend.dto.response.ChatCompletionResponse;
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

@Service
public class OpenAiImageDescriptionService implements ImageDescriptionService {

    private static final Logger log = LoggerFactory.getLogger(OpenAiImageDescriptionService.class);
    private final ObjectMapper objectMapper;
    private RestClient completitionClient;

    public OpenAiImageDescriptionService(ObjectMapper objectMapper,
                                         @Qualifier("completionClient") RestClient completitionClient) {
        this.objectMapper = objectMapper;
        this.completitionClient = completitionClient;
    }

    @SneakyThrows
    public String getImageTextRepresentation(byte[] bytes) {
        String base64Representation = Base64.getEncoder().encodeToString(bytes);
        String requestBody = objectMapper.writeValueAsString(new ChatCompletionRequest(base64Representation));
        ResponseEntity<ChatCompletionResponse> textDescriptionResponse = completitionClient.post()
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody)
                .retrieve()
                .toEntity(ChatCompletionResponse.class);

        String logMessage = String.format("[method:POST] [api_call:openAiChat] Response=%s", objectMapper.writeValueAsString(textDescriptionResponse.getBody()));
        if(textDescriptionResponse.getStatusCode().is2xxSuccessful()){
            log.info(logMessage);
        }else{
            log.error(logMessage);
            throw new RuntimeException("Falló la call al descriptionService");
        }
        return textDescriptionResponse.getBody().getChoices().getFirst().getMessage().getContent();
    }
}
