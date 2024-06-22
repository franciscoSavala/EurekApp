package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.FoundObjectDto;
import com.eurekapp.backend.dto.TopSimilarFoundObjectsDto;
import com.eurekapp.backend.dto.ImageUploadedResponseDto;
import com.eurekapp.backend.model.FoundObjectVector;
import com.eurekapp.backend.service.client.OpenAiEmbeddingModelService;
import com.eurekapp.backend.service.client.OpenAiImageDescriptionService;
import com.eurekapp.backend.repository.TextPineconeRepository;
import com.eurekapp.backend.repository.S3Service;
import com.google.protobuf.Struct;
import com.google.protobuf.Value;
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
    private final TextPineconeRepository<FoundObjectVector> imageVectorTextPineconeRepository;


    public PhotoService(S3Service s3Service, OpenAiImageDescriptionService descriptionService, OpenAiEmbeddingModelService embeddingService, TextPineconeRepository<FoundObjectVector> imageVectorTextPineconeRepository) {
        this.s3Service = s3Service;
        this.descriptionService = descriptionService;
        this.embeddingService = embeddingService;
        this.imageVectorTextPineconeRepository = imageVectorTextPineconeRepository;
    }

    @SneakyThrows
    public ImageUploadedResponseDto uploadFoundObject(MultipartFile file, String description) {
        byte[] bytes = file.getBytes();
        String textRepresentation = descriptionService.getImageTextRepresentation(bytes);
        List<Float> embeddings = embeddingService.getTextVectorRepresentation(textRepresentation);
        String foundObjectId = UUID.randomUUID().toString();
        FoundObjectVector foundObjectVector = FoundObjectVector.builder()
                .id(foundObjectId)
                .text(textRepresentation)
                .embeddings(embeddings)
                .humanDescription(description)
                .build();
        // TODO: VER COMO HACERLO ASYNC
        imageVectorTextPineconeRepository.upsertVector(foundObjectVector);
        s3Service.putObject(bytes, foundObjectId);
        log.info("[api_method:POST] [service:S3] Bytes processed: {}", bytes.length);
        return ImageUploadedResponseDto.builder()
                .textEncodind(textRepresentation)
                .description(description)
                .id(foundObjectId)
                .build();
    }

    @SneakyThrows
    public List<FoundObjectDto> getImagesByImageSimilarity(MultipartFile file){
        byte[] bytes = file.getBytes();
        String textRepresentation = descriptionService.getImageTextRepresentation(bytes);
        List<Float> embeddings = embeddingService.getTextVectorRepresentation(textRepresentation);
        FoundObjectVector foundObjectVector = FoundObjectVector.builder()
                .text(textRepresentation)
                .embeddings(embeddings)
                .build();
        List<FoundObjectVector> foundObjectVectors = imageVectorTextPineconeRepository.queryVector(foundObjectVector);
        return foundObjectVectors.stream()
                .map(this::foundObjectToDto)
                .sorted(Comparator.comparing(FoundObjectDto::getScore).reversed())
                .toList();
    }

    @SneakyThrows
    public TopSimilarFoundObjectsDto getFoundObjectByTextDescription(String query, Long organizationId){
        List<Float> embeddings = embeddingService.getTextVectorRepresentation(query);
        FoundObjectVector textVector = FoundObjectVector.builder()
                .text(query)
                .embeddings(embeddings)
                .build();
        Struct.Builder filter = Struct.newBuilder();
        if(organizationId != null){
            filter.putFields("organization_id", Value.newBuilder().setStringValue(String.valueOf(organizationId)).build());
        }
        List<FoundObjectVector> foundObjectVectors = imageVectorTextPineconeRepository.queryVector(textVector, 5, filter.build());

        List<FoundObjectDto> foundObjectDtos = foundObjectVectors.stream()
                .filter(v -> v.getScore() >= 0.6) //Retorna los que tengan el score mayor a 0.6
                .map(this::foundObjectToDto)
                .sorted(Comparator.comparing(FoundObjectDto::getScore).reversed())
                .toList();

        return TopSimilarFoundObjectsDto.builder()
                .foundObjects(foundObjectDtos)
                .build();
    }

    public FoundObjectDto foundObjectToDto(FoundObjectVector foundObjectVector) {
        byte[] bytes = s3Service.getObjectBytes(foundObjectVector.getId());
        log.info("[api_method:GET] [service:S3] Bytes processed: {}", bytes.length);
        return FoundObjectDto.builder()
                .id(foundObjectVector.getId())
                .description(foundObjectVector.getHumanDescription())
                .b64Json(Base64.getEncoder().encodeToString(bytes))
                .score(foundObjectVector.getScore())
                .build();
    }
}
