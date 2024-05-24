package com.eurekapp.backend.service.client;

import com.eurekapp.backend.model.response.ChatCompletitionResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import software.amazon.awssdk.services.s3.endpoints.internal.Value;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Service
public class OpenAiImageDescriptionService {

    private static final Logger log = LoggerFactory.getLogger(OpenAiImageDescriptionService.class);
    private RestClient completitionClient;

    public OpenAiImageDescriptionService(RestClient completitionClient) {
        this.completitionClient = completitionClient;
    }

    public String getImageTextRepresentation(byte[] bytes) {
        String base64Representation = Base64.getEncoder().encodeToString(bytes);
        String requestBody = String.format("""
                        {
                            "model": "gpt-4o",
                            "messages": [
                                {
                                  "role": "user",
                                  "content": [
                                    {
                                      "type": "text",
                                      "text": "Haz como si hayas perdido el objeto principal de la imagen y descríbelo"
                                    },
                                    {
                                      "type": "image_url",
                                      "image_url": {
                                        "url": "data:image/jpeg;base64,%s",
                                        "detail":"low"
                                      }
                                    }
                                  ]
                                }
                              ],
                            "max_tokens":50
                        }
                        """, base64Representation);
        ChatCompletitionResponse textDescriptionResponse = completitionClient.post()
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, (request, response) -> {
                    log.error("[method:POST] [api_call:openAiChat] Request={} Response={}", request.getMethod(), new String(response.getBody().readAllBytes()));
                })
                .body(ChatCompletitionResponse.class);

        return textDescriptionResponse.getChoices().getFirst().getMessage().getContent();
    }
}
