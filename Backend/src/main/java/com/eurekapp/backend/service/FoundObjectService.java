package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.FoundObjectDto;
import com.eurekapp.backend.dto.OrganizationDto;
import com.eurekapp.backend.dto.FoundObjectsListDto;
import com.eurekapp.backend.dto.FoundObjectUploadedResponseDto;
import com.eurekapp.backend.exception.ApiException;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.exception.ValidationError;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.repository.FoundObjectRepository;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.ObjectStorage;
import com.eurekapp.backend.repository.VectorStorage;
import com.eurekapp.backend.service.client.EmbeddingService;
import com.eurekapp.backend.service.client.ImageDescriptionService;
import lombok.SneakyThrows;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;


import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;


@Service
public class FoundObjectService implements IFoundObjectService {
    private static final double MIN_SCORE = 0.0;
    private static final int GRACE_HOURS = 6;

    private static final Logger log = LoggerFactory.getLogger(FoundObjectService.class);
    private final ObjectStorage s3Service;
    private final ImageDescriptionService descriptionService;
    private final EmbeddingService embeddingService;
    private final VectorStorage<FoundObjectStructVector> foundObjectVectorStorage;
    private final IOrganizationRepository organizationRepository;
    private final OrganizationService organizationService;
    private final LostObjectService lostObjectService;
    private final ExecutorService executorService;
    private final FoundObjectRepository foundObjectRepository;

    public FoundObjectService(ObjectStorage s3Service,
                              ImageDescriptionService descriptionService,
                              EmbeddingService embeddingService,
                              VectorStorage<FoundObjectStructVector> foundObjectVectorStorage,
                              IOrganizationRepository organizationRepository,
                              OrganizationService organizationService,
                              LostObjectService lostObjectService,
                              ExecutorService executorService, FoundObjectRepository foundObjectRepository) {
        this.s3Service = s3Service;
        this.descriptionService = descriptionService;
        this.embeddingService = embeddingService;
        this.foundObjectVectorStorage = foundObjectVectorStorage;
        this.organizationRepository = organizationRepository;
        this.organizationService = organizationService;
        this.lostObjectService = lostObjectService;
        this.executorService = executorService;
        this.foundObjectRepository = foundObjectRepository;
    }

    /* El propósito de este método es postear un objeto encontrado. Toma como parámetros la foto del objeto encontrado,
    *   una descripción textual provista por el usuario, y el ID del establecimiento en el que se encontró, */
    @SneakyThrows
    public FoundObjectUploadedResponseDto uploadFoundObject(UploadFoundObjectCommand command) {
        // Convertimos el archivo de imagen en bytes, para poder enviarlo en una request.
        //TODO: implementar alguna forma para disminuir la calidad de la imagen si es muy grande
        final byte[] imageBytes = command.getImage().getBytes();

        // Antes de seguir, chequeamos que el ID de organización provisto corresponda a una organización que existe.
        if(command.getOrganizationId() == null
                || !organizationRepository.existsById(command.getOrganizationId()))
            throw new NotFoundException("org_not_found", String.format("Organization with id '%d' not found", command.getOrganizationId()));
        if(command.getFoundDate().isAfter(LocalDateTime.now()))
            throw new BadRequestException(ValidationError.FOUND_DATE_ERROR);
        // Solicitamos a la API "OpenAI Chat Completion" una descripción textual de la foto.
        String textRepresentation = descriptionService.getImageTextRepresentation(imageBytes);

        /* Solicitamos a la API "OpenAI Embeddings" una representación vectorial de la concatenación de la
        descripción textual que nos dio la otra API, y de la descripción y título provistos por el humano. */
        List<Float> embeddings = embeddingService.getTextVectorRepresentation(textRepresentation +" "+ command.getDetailedDescription() +" "+ command.getTitle());

        // Generamos de forma aleatoria un ID para el post de objeto encontrado.
        String foundObjectId = UUID.randomUUID().toString();

        FoundObject foundObject = FoundObject.builder()
                .uuid(foundObjectId)
                .title(command.getTitle())
                .humanDescription(command.getDetailedDescription())
                .aiDescription(textRepresentation)
                .embeddings(embeddings)
                .organizationId(String.valueOf(command.getOrganizationId()))
                .foundDate(command.getFoundDate())
                .coordinates(GeoCoordinates.builder().latitude(0.5).longitude(0.9).build())
                .wasReturned(false)
                .build();

        Future<Void> addFuture = (Future<Void>) executorService.submit(() -> foundObjectRepository.add(foundObject));
        Future<Void> uploadImageFuture = (Future<Void>) executorService.submit(() -> s3Service.putObject(imageBytes, foundObjectId));
        try {
            addFuture.get();
            uploadImageFuture.get();
        } catch (ExecutionException | InterruptedException e){
            log.error(e.toString());
            throw new ApiException("upload_error", "There was an error uploading your object", HttpStatus.INTERNAL_SERVER_ERROR);
        }
        executorService.execute(() -> lostObjectService.findSimilarLostObject(
                embeddings, command.getOrganizationId(), command.getTitle(), foundObjectId));
        // Asentamos la operación en el log.
        log.info("[api_method:POST] [service:S3] Bytes processed: {}", imageBytes.length);

        return FoundObjectUploadedResponseDto.builder()
                .textEncoding(textRepresentation)
                .description(command.getTitle())
                .id(foundObjectId)
                .build();
    }

    /**
     * Busca los objetos encontrados que tengan cierto puntaje mínimo
     * y que estén en cierta fecha
     * @param command Objeto que tiene todos los parámetros para que el método haga algo...
     * @return
     */
    @SneakyThrows
    public FoundObjectsListDto getFoundObjectByTextDescription(SimilarObjectsCommand command){
        List<Float> embeddings = embeddingService.getTextVectorRepresentation(command.getQuery());
        //TODO: Hacer una implementación de StructVector pero que solo se use para buscar, es decir que solo tenga embeddings

        // Le pedimos a FoundObjectRepository que nos devuelva los objetos FoundObject cercanos al vector, con fecha
        // posterior a la provista, y opcionalmente con id de organización igual al provisto, si fue provisto.
        String orgId = null;
        if(command.getOrganizationId() != null){ orgId = command.getOrganizationId().toString();}
        List<FoundObject> foundObjects = foundObjectRepository.query(embeddings,
                                                                    orgId,
                                                                    command.getLostDate(),
                                                        false);

        // Convertimos los FoundObject a FoundObjectDto para poder devolverlos en la respuesta.
        List<FoundObjectDto> result = foundObjects.stream()
                .map(this::foundObjectToDto)
                .sorted(Comparator.comparing(FoundObjectDto::getScore).reversed())
                .toList();

        return FoundObjectsListDto.builder()
                .foundObjects(result)
                .build();
    }

    private FoundObjectDto foundObjectToDto(FoundObject foundObject) {
        byte[] imageBytes = s3Service.getObjectBytes(foundObject.getUuid());
        log.info("[api_method:GET] [service:S3] Retriving {}, Bytes processed: {}",
                foundObject.getUuid(), imageBytes.length);
        Long objectOrganizationId = Long.parseLong(foundObject.getOrganizationId());
        Organization organization = organizationRepository.findById(objectOrganizationId)
                .orElse(null);
        OrganizationDto organizationDto = organization != null ?
                organizationService.organizationToDto(organization) :
                null;
        return FoundObjectDto.builder()
                .id(foundObject.getUuid())
                .title(foundObject.getTitle())
                .b64Json(Base64.getEncoder().encodeToString(imageBytes))
                .score(foundObject.getScore())
                .organization(organizationDto)
                .foundDate(foundObject.getFoundDate())
                .build();
    }

    /**
     * Este método retorna todos los objetos encontrados en una organización que aún no han sido devueltos.
     * **/
    public FoundObjectsListDto getAllUnreturnedFoundObjectsByOrganization(SimilarObjectsCommand command){
        // Pedimos a FoundObjectRepository que devuelva todos los objetos aún no devueltos que esté reteniendo la organización.
        String orgId;
        if(command.getOrganizationId() != null){ orgId = command.getOrganizationId().toString();}
        else{ throw new IllegalArgumentException("ERROR: Se debe proveer un ID de organización."); }
        List<FoundObject> foundObjects = foundObjectRepository.query(null,
                orgId,
                null,
                false);

        // Convertimos los FoundObject a FoundObjectDto para poder devolverlos en la respuesta.
        List<FoundObjectDto> result = foundObjects.stream()
                .map(this::foundObjectToDto)
                .toList();

        return FoundObjectsListDto.builder()
                .foundObjects(result)
                .build();
    }
}
