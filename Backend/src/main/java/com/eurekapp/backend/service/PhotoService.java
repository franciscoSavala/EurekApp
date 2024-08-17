package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.FoundObjectDto;
import com.eurekapp.backend.dto.OrganizationDto;
import com.eurekapp.backend.dto.TopSimilarFoundObjectsDto;
import com.eurekapp.backend.dto.ImageUploadedResponseDto;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.FoundObjectStructVector;
import com.eurekapp.backend.model.Organization;
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
    private final OrganizationService organizationService;


    public PhotoService(ObjectStorage s3Service,
                        ImageDescriptionService descriptionService,
                        EmbeddingService embeddingService,
                        VectorStorage<FoundObjectStructVector> imageVectorTextPineconeRepository,
                        IOrganizationRepository organizationRepository, OrganizationService organizationService) {
        this.s3Service = s3Service;
        this.descriptionService = descriptionService;
        this.embeddingService = embeddingService;
        this.imageVectorTextPineconeRepository = imageVectorTextPineconeRepository;
        this.organizationRepository = organizationRepository;
        this.organizationService = organizationService;
    }

    /* El propósito de este método es postear un objeto encontrado. Toma como parámetros la foto del objeto encontrado,
    *   una descripción textual provista por el usuario, y el ID del establecimiento en el que se encontró, */
    @SneakyThrows
    public ImageUploadedResponseDto uploadFoundObject(MultipartFile file, String description, Long organizationId) {

        // Convertimos el archivo de imagen en bytes, para poder enviarlo en una request.
        byte[] bytes = file.getBytes();

        // Antes de seguir, chequeamos que el ID de organización provisto corresponda a una organización que existe.
        if(organizationId != null && !organizationRepository.existsById(organizationId)) throw new NotFoundException(String.format("Organization with id '%d' not found", organizationId));
        //if(!validateFileContentType(file)) throw new NotValidContentTypeException(String.format("Content type %s not valid, should be one of the following: %s", file.getContentType(), String.join(", ", VALID_CONTENT_TYPES)));

        // Solicitamos a la API "OpenAI Chat Completion" una descripción textual de la foto.
        String textRepresentation = descriptionService.getImageTextRepresentation(bytes);

        /* Solicitamos a la API "OpenAI Embeddings" una representación vectorial de la descripción textual que nos dio
        *   la otra API. */
        List<Float> embeddings = embeddingService.getTextVectorRepresentation(textRepresentation);

        // Generamos de forma aleatoria un ID para el post de objeto encontrado.
        String foundObjectId = UUID.randomUUID().toString();

        /* Pasmos el vector generado y los demás datos a este método que los usará para construir un objeto "Struct".
        *   Esto es necesario para poder meterlo en la BD Pinecone. */
        FoundObjectStructVector foundObjectVector = FoundObjectStructVector.builder()
                .id(foundObjectId)
                .text(textRepresentation)
                .embeddings(embeddings)
                .humanDescription(description)
                .organization(String.valueOf(organizationId))
                .build();
        // TODO: VER COMO HACERLO ASYNC

        // Hacemos el upsert en la BD Pinecone.
        imageVectorTextPineconeRepository.upsertVector(foundObjectVector);

        // Subimos la foto provista por el usuario a la BD Amazon S3.
        s3Service.putObject(bytes, foundObjectId);

        // Asentamos la operación en el log.
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
        Long objectOrganizationId = Long.parseLong(foundObjectVector.getOrganization());
        Organization organization = organizationRepository.findById(objectOrganizationId)
                .orElse(null);
        OrganizationDto organizationDto = organization != null ?
                organizationService.organizationToDto(organization) :
                null;
        return FoundObjectDto.builder()
                .id(foundObjectVector.getId())
                .description(foundObjectVector.getHumanDescription())
                .b64Json(Base64.getEncoder().encodeToString(bytes))
                .score(foundObjectVector.getScore())
                .organization(organizationDto)
                .build();
    }
}
