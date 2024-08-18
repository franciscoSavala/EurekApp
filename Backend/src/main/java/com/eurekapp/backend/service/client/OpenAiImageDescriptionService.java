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


    /* Este método recibe una foto en forma de bytes, se comunica con la API de Open AI Chat Completion para obtener una descripción
    *   textual de dicha imagen, y devuelve dicha descripción textual. */
    @SneakyThrows
    public String getImageTextRepresentation(byte[] bytes) {
        // Representamos los bytes de la imagen en base64.
        String base64Representation = Base64.getEncoder().encodeToString(bytes);

        // Esta línea arma el JSON que enviaremos en la request a la API de Open AI Chat Completion.
        String requestBody = objectMapper.writeValueAsString(new ChatCompletionRequest(base64Representation));

        // Enviamos la request, y guardamos la respuesta de la API en la variable "textDescriptionResponse".
        ResponseEntity<ChatCompletionResponse> textDescriptionResponse = completitionClient.post()
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody)
                .retrieve()
                .toEntity(ChatCompletionResponse.class);

        // Armamos el mensaje que se asentará en el log.
        String logMessage = String.format("[method:POST] [api_call:openAiChat] Response=%s", objectMapper.writeValueAsString(textDescriptionResponse.getBody()));

        // Si la request fue exitosa, guardamos el mensaje en e log. Sino, lanzamos una excepción.
        if(textDescriptionResponse.getStatusCode().is2xxSuccessful()){
            log.info(logMessage);
        }else{
            log.error(logMessage);
            throw new RuntimeException("Falló la call al descriptionService");
        }

        // Finalmente, si no se lanzó una excepción, devolvemos la descripción textual de la foto.
        return textDescriptionResponse.getBody().getChoices().getFirst().getMessage().getContent();
    }
}
