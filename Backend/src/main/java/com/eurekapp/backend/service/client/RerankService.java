package com.eurekapp.backend.service.client;

import com.eurekapp.backend.dto.FoundObjectDto;
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

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class RerankService {

    private static final Logger log = LoggerFactory.getLogger(RerankService.class);
    private final RestClient completitionClient;
    private final ObjectMapper objectMapper;

    public RerankService(@Qualifier("completionClient") RestClient completitionClient, ObjectMapper objectMapper) {
        this.completitionClient = completitionClient;
        this.objectMapper = objectMapper;
    }

    @SneakyThrows
    public List<String> rerank(String query, List<FoundObjectDto> candidates) {
        StringBuilder candidatesText = new StringBuilder();
        for (FoundObjectDto c : candidates) {
            candidatesText.append("- id: ").append(c.getId())
                    .append(", title: ").append(c.getTitle())
                    .append(", description: ").append(c.getHumanDescription())
                    .append("\n");
        }

        String userContent = "Query del usuario: \"" + query + "\"\n\n" +
                "Candidatos:\n" + candidatesText +
                "\nDevolvé únicamente un JSON array con los IDs en orden de relevancia descendente. " +
                "Ejemplo: [\"uuid1\", \"uuid2\"]. No incluyas explicaciones.";

        Map<String, Object> request = Map.of(
                "model", "gpt-4o-mini",
                "max_tokens", 200,
                "messages", List.of(
                        Map.of("role", "system", "content",
                                "Eres un sistema de re-ranking para objetos perdidos. " +
                                "Ordena los candidatos por relevancia respecto al query."),
                        Map.of("role", "user", "content", userContent)
                )
        );

        ResponseEntity<ChatCompletionResponse> response = completitionClient.post()
                .contentType(MediaType.APPLICATION_JSON)
                .body(objectMapper.writeValueAsString(request))
                .retrieve()
                .toEntity(ChatCompletionResponse.class);

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            log.warn("Rerank falló, devolviendo orden original");
            return candidates.stream().map(FoundObjectDto::getId).toList();
        }

        String content = response.getBody().getChoices().getFirst().getMessage().getContent().trim();
        List<String> ranked = objectMapper.readValue(content,
                objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
        return ranked;
    }
}
