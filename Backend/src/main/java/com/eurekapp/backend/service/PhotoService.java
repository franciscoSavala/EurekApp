package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.FoundObjectDto;
import com.eurekapp.backend.dto.TopSimilarFoundObjectsDto;
import com.eurekapp.backend.dto.ImageUploadedResponseDto;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.FoundObjectStructVector;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.ObjectStorage;
import com.eurekapp.backend.repository.VectorStorage;
import com.eurekapp.backend.service.client.EmbeddingService;
import com.eurekapp.backend.service.client.ImageDescriptionService;
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
public class PhotoService implements FoundObjectService {

    private static final List<String> VALID_CONTENT_TYPES = List.of("image/png", "image/jpeg", "image/jpg");

    private static final Logger log = LoggerFactory.getLogger(PhotoService.class);
    private final ObjectStorage s3Service;
    private final ImageDescriptionService descriptionService;
    private final EmbeddingService embeddingService;
    private final VectorStorage<FoundObjectStructVector> imageVectorTextPineconeRepository;
    private final IOrganizationRepository organizationRepository;


    public PhotoService(ObjectStorage s3Service,
                        ImageDescriptionService descriptionService,
                        EmbeddingService embeddingService,
                        VectorStorage<FoundObjectStructVector> imageVectorTextPineconeRepository,
                        IOrganizationRepository organizationRepository) {
        this.s3Service = s3Service;
        this.descriptionService = descriptionService;
        this.embeddingService = embeddingService;
        this.imageVectorTextPineconeRepository = imageVectorTextPineconeRepository;
        this.organizationRepository = organizationRepository;
    }

    @SneakyThrows
    public ImageUploadedResponseDto uploadFoundObject(MultipartFile file, String description, Long organizationId) {
        byte[] bytes = file.getBytes();
        if(organizationId != null && !organizationRepository.existsById(organizationId)) throw new NotFoundException(String.format("Organization with id '%d' not found", organizationId));
        //if(!validateFileContentType(file)) throw new NotValidContentTypeException(String.format("Content type %s not valid, should be one of the following: %s", file.getContentType(), String.join(", ", VALID_CONTENT_TYPES)));
        String textRepresentation = descriptionService.getImageTextRepresentation(bytes);
        List<Float> embeddings = embeddingService.getTextVectorRepresentation(textRepresentation);
        String foundObjectId = UUID.randomUUID().toString();
        FoundObjectStructVector foundObjectVector = FoundObjectStructVector.builder()
                .id(foundObjectId)
                .text(textRepresentation)
                .embeddings(embeddings)
                .humanDescription(description)
                .organization(String.valueOf(organizationId))
                .build();
        // TODO: VER COMO HACERLO ASYNC
        imageVectorTextPineconeRepository.upsertVector(foundObjectVector);
        s3Service.putObject(bytes, foundObjectId);
        log.info("[api_method:POST] [service:S3] Bytes processed: {}", bytes.length);
        return ImageUploadedResponseDto.builder()
                .textEncoding(textRepresentation)
                .description(description)
                .id(foundObjectId)
                .build();
    }

    private boolean validateFileContentType(MultipartFile file) {
        return VALID_CONTENT_TYPES.stream()
                .anyMatch(ct -> ct.equals(file.getContentType()));
    }

    @SneakyThrows
    public TopSimilarFoundObjectsDto getFoundObjectByTextDescription(String query, Long organizationId){
        List<Float> embeddings = embeddingService.getTextVectorRepresentation(query);
        FoundObjectStructVector textVector = FoundObjectStructVector.builder()
                .text(query)
                .embeddings(embeddings)
                .build();
        Struct.Builder filter = Struct.newBuilder();
        if(organizationId != null){
            filter.putFields("organization_id", Value.newBuilder().setStringValue(String.valueOf(organizationId)).build());
        }
        List<FoundObjectStructVector> foundObjectVectors = imageVectorTextPineconeRepository.queryVector(textVector, 5, filter.build());

        List<FoundObjectDto> foundObjectDtos = foundObjectVectors.stream()
                .filter(v -> v.getScore() >= 0.6) //Retorna los que tengan el score mayor a 0.6
                .map(this::foundObjectToDto)
                .sorted(Comparator.comparing(FoundObjectDto::getScore).reversed())
                .toList();

        return TopSimilarFoundObjectsDto.builder()
                .foundObjects(foundObjectDtos)
                .build();
    }

    private FoundObjectDto foundObjectToDto(FoundObjectStructVector foundObjectVector) {
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
