package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.ImageScoreDto;
import com.eurekapp.backend.dto.TopSimilarImagesDto;
import com.eurekapp.backend.dto.ImageUploadedResponseDto;
import com.eurekapp.backend.model.ImageVector;
import com.eurekapp.backend.service.client.OpenAiEmbeddingModelService;
import com.eurekapp.backend.service.client.OpenAiImageDescriptionService;
import com.eurekapp.backend.service.client.TextPineconeService;
import com.eurekapp.backend.service.client.S3Service;
import lombok.SneakyThrows;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class PhotoService {

    private static final Logger log = LoggerFactory.getLogger(PhotoService.class);
    private final S3Service s3Service;
    private final OpenAiImageDescriptionService descriptionService;
    private final OpenAiEmbeddingModelService embeddingService;
    private final TextPineconeService<ImageVector> imageVectorTextPineconeService;


    public PhotoService(S3Service s3Service, OpenAiImageDescriptionService descriptionService, OpenAiEmbeddingModelService embeddingService, TextPineconeService<ImageVector> imageVectorTextPineconeService) {
        this.s3Service = s3Service;
        this.descriptionService = descriptionService;
        this.embeddingService = embeddingService;
        this.imageVectorTextPineconeService = imageVectorTextPineconeService;
    }

    @SneakyThrows
    public ImageUploadedResponseDto uploadPhoto(MultipartFile file, String description) {
        byte[] bytes = file.getBytes();
        String textRepresentation = descriptionService.getImageTextRepresentation(bytes);
        List<Float> embeddings = embeddingService.getTextVectorRepresentation(textRepresentation);
        String imageId = UUID.randomUUID().toString();
        ImageVector imageVector = ImageVector.builder()
                .id(imageId)
                .text(textRepresentation)
                .embeddings(embeddings)
                .humanDescription(description)
                .build();
        // TODO: VER COMO HACERLO ASYNC
        imageVectorTextPineconeService.upsertVector(imageVector);
        s3Service.putObject(bytes, imageId);
        log.info("[api_method:POST] [service:S3] Bytes processed: {}", bytes.length);
        return ImageUploadedResponseDto.builder()
                .textEncodind(textRepresentation)
                .description(description)
                .id(imageId)
                .build();
    }

    @SneakyThrows
    public List<ImageScoreDto> getImagesByImageSimilarity(MultipartFile file){
        byte[] bytes = file.getBytes();
        String textRepresentation = descriptionService.getImageTextRepresentation(bytes);
        List<Float> embeddings = embeddingService.getTextVectorRepresentation(textRepresentation);
        ImageVector imageVector = ImageVector.builder()
                .text(textRepresentation)
                .embeddings(embeddings)
                .build();
        List<ImageVector> imageVectors = imageVectorTextPineconeService.queryVector(imageVector);
        return imageVectors.stream()
                .map(this::imageVectorToImageScoreDto)
                .sorted(Comparator.comparing(ImageScoreDto::getScore).reversed())
                .toList();
    }

    @SneakyThrows
    public TopSimilarImagesDto getImageByTextDescription(String query){
        List<Float> embeddings = embeddingService.getTextVectorRepresentation(query);
        ImageVector textVector = ImageVector.builder() // ESTO ESTÁ MAL DEBERIA SER UN TEXTVECTOR PERO ME BUGUEE
                .text(query)
                .embeddings(embeddings)
                .build();
        List<ImageVector> imageVectors = imageVectorTextPineconeService.queryVector(textVector);

        List<ImageScoreDto> imageScoreDtos = imageVectors.stream()
                .map(this::imageVectorToImageScoreDto)
                .sorted(Comparator.comparing(ImageScoreDto::getScore).reversed())
                .toList();

        return TopSimilarImagesDto.builder()
                .imageScoreDtos(imageScoreDtos)
                .build();

    }

    public ImageScoreDto imageVectorToImageScoreDto(ImageVector imageVector) {
        byte[] bytes = s3Service.getObjectBytes(imageVector.getId());
        log.info("[api_method:GET] [service:S3] Bytes processed: {}", bytes.length);
        return ImageScoreDto.builder()
                .textRepresentation(imageVector.getText())
                .id(imageVector.getId())
                .b64Json(Base64.getEncoder().encodeToString(bytes))
                .score(imageVector.getScore())
                .build();
    }
}
