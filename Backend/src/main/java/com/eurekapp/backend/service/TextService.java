package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.TextRequestDto;
import com.eurekapp.backend.dto.TextResponseDto;
import com.eurekapp.backend.dto.TopEqualTextDto;
import com.eurekapp.backend.model.TextPostedResponseDto;
import com.eurekapp.backend.model.TextVector;
import com.eurekapp.backend.model.TextVectorScore;
import com.eurekapp.backend.service.client.OpenAiEmbeddingModelService;
import com.eurekapp.backend.repository.TextPineconeRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class TextService {

    private final OpenAiEmbeddingModelService openAiEmbeddingModelService;
    private final TextPineconeRepository textPineconeRepository;

    public TextService(OpenAiEmbeddingModelService openAiEmbeddingModelService, TextPineconeRepository textPineconeRepository) {
        this.openAiEmbeddingModelService = openAiEmbeddingModelService;
        this.textPineconeRepository = textPineconeRepository;
    }

    public List<Float> retriveEmbeddingFromText(String text){
        return openAiEmbeddingModelService.getTextVectorRepresentation(text);
    }

    public TopEqualTextDto getSimilarTextFrom(TextRequestDto textRequestDto) {
        List<Float> embeddings = openAiEmbeddingModelService.getTextVectorRepresentation(textRequestDto.getText());
        TextVector textVector = createTextVector(embeddings, textRequestDto.getText());
        List<TextVectorScore> vectorScores = textPineconeRepository.queryVector(textVector);
        List<TextResponseDto> textResponseDtos = vectorScores.stream()
                .map(t -> TextResponseDto.builder()
                        .score(String.format("%f", t.getScore()))
                        .text(t.getText())
                        .build())
                .toList();
        return new TopEqualTextDto(textResponseDtos);
    }

    public TextPostedResponseDto postText(TextRequestDto textRequestDto) {
        List<Float> embeddings = openAiEmbeddingModelService.getTextVectorRepresentation(textRequestDto.getText());
        TextVector textVector = createTextVector(embeddings, textRequestDto.getText());
        textPineconeRepository.upsertVector(textVector);
        return TextPostedResponseDto.builder()
                .id(textVector.getId())
                .build();
    }

    private TextVector createTextVector(List<Float> embeddings, String text){
        return TextVector.builder()
                .id(UUID.randomUUID().toString())
                .embeddings(embeddings)
                .text(text)
                .build();
    }
}
