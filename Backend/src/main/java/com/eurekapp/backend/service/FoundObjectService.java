package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.FoundObjectDto;
import com.eurekapp.backend.dto.OrganizationDto;
import com.eurekapp.backend.dto.FoundObjectsListDto;
import com.eurekapp.backend.dto.FoundObjectUploadedResponseDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.exception.ValidationError;
import com.eurekapp.backend.model.FoundObjectStructVector;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.SimilarObjectsCommand;
import com.eurekapp.backend.model.UploadFoundObjectCommand;
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

import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.function.Predicate;

@Service
public class FoundObjectService implements IFoundObjectService {
    private static final double MIN_SCORE = 0.6;
    private static final int GRACE_HOURS = 6;

    private static final Logger log = LoggerFactory.getLogger(FoundObjectService.class);
    private final ObjectStorage s3Service;
    private final ImageDescriptionService descriptionService;
    private final EmbeddingService embeddingService;
    private final VectorStorage<FoundObjectStructVector> foundObjectVectorStorage;
    private final IOrganizationRepository organizationRepository;
    private final OrganizationService organizationService;
    private final LostObjectService lostObjectService;

    public FoundObjectService(ObjectStorage s3Service,
                              ImageDescriptionService descriptionService,
                              EmbeddingService embeddingService,
                              VectorStorage<FoundObjectStructVector> foundObjectVectorStorage,
                              IOrganizationRepository organizationRepository,
                              OrganizationService organizationService,
                              LostObjectService lostObjectService) {
        this.s3Service = s3Service;
        this.descriptionService = descriptionService;
        this.embeddingService = embeddingService;
        this.foundObjectVectorStorage = foundObjectVectorStorage;
        this.organizationRepository = organizationRepository;
        this.organizationService = organizationService;
        this.lostObjectService = lostObjectService;
    }

    /* El propósito de este método es postear un objeto encontrado. Toma como parámetros la foto del objeto encontrado,
    *   una descripción textual provista por el usuario, y el ID del establecimiento en el que se encontró, */
    @SneakyThrows
    public FoundObjectUploadedResponseDto uploadFoundObject(UploadFoundObjectCommand command) {
        // Convertimos el archivo de imagen en bytes, para poder enviarlo en una request.
        byte[] imageBytes = command.getImage().getBytes();
        // Antes de seguir, chequeamos que el ID de organización provisto corresponda a una organización que existe.
        if(command.getOrganizationId() == null
                || !organizationRepository.existsById(command.getOrganizationId()))
            throw new NotFoundException("org_not_found", String.format("Organization with id '%d' not found", command.getOrganizationId()));
        if(command.getFoundDate().isAfter(LocalDateTime.now()))
            throw new BadRequestException(ValidationError.FOUND_DATE_ERROR);
        // Solicitamos a la API "OpenAI Chat Completion" una descripción textual de la foto.
        String textRepresentation = descriptionService.getImageTextRepresentation(imageBytes);

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
                .humanDescription(command.getDescription())
                .organization(String.valueOf(command.getOrganizationId()))
                .foundDate(command.getFoundDate())
                .wasReturned(false)
                .build();
        // TODO: VER COMO HACERLO ASYNC

        // Hacemos el upsert en la BD Pinecone.
        foundObjectVectorStorage.upsertVector(foundObjectVector);

        // Subimos la foto provista por el usuario a la BD Amazon S3.
        s3Service.putObject(imageBytes, foundObjectId);

        lostObjectService.findSimilarLostObject(
                embeddings, command.getOrganizationId(), command.getDescription(), imageBytes, foundObjectId);

        // Asentamos la operación en el log.
        log.info("[api_method:POST] [service:S3] Bytes processed: {}", imageBytes.length);

        return FoundObjectUploadedResponseDto.builder()
                .textEncoding(textRepresentation)
                .description(command.getDescription())
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
        FoundObjectStructVector foundObjectVector = FoundObjectStructVector.builder()
                .text(command.getQuery())
                .embeddings(embeddings)
                .build();
        Struct.Builder filter = Struct.newBuilder();
        if(command.getOrganizationId() != null){
            filter.putFields("organization_id",
                    Value.newBuilder().setStringValue(
                            String.valueOf(command.getOrganizationId())).build());
        }
        List<FoundObjectStructVector> foundObjectVectors = foundObjectVectorStorage.queryVector(foundObjectVector, 5, filter.build());

        List<FoundObjectDto> foundObjectDtos = foundObjectVectors.stream()
                .filter(isFoundDateAfterLostDate(command))
                .filter(v -> v.getScore() >= MIN_SCORE)
                .map(this::foundObjectToDto)
                .sorted(Comparator.comparing(FoundObjectDto::getScore).reversed())
                .toList();

        return FoundObjectsListDto.builder()
                .foundObjects(foundObjectDtos)
                .build();
    }

    private Predicate<FoundObjectStructVector> isFoundDateAfterLostDate(SimilarObjectsCommand command) {
        return v -> command.getLostDate() == null ||
                v.getFoundDate().isAfter(command.getLostDate().minusHours(GRACE_HOURS));
    }

    private FoundObjectDto foundObjectToDto(FoundObjectStructVector foundObjectVector) {
        byte[] imageBytes = s3Service.getObjectBytes(foundObjectVector.getId());
        log.info("[api_method:GET] [service:S3] Retriving {}, Bytes processed: {}",
                foundObjectVector.getId(), imageBytes.length);
        Long objectOrganizationId = Long.parseLong(foundObjectVector.getOrganization());
        Organization organization = organizationRepository.findById(objectOrganizationId)
                .orElse(null);
        OrganizationDto organizationDto = organization != null ?
                organizationService.organizationToDto(organization) :
                null;
        return FoundObjectDto.builder()
                .id(foundObjectVector.getId())
                .description(foundObjectVector.getHumanDescription())
                .b64Json(Base64.getEncoder().encodeToString(imageBytes))
                .score(foundObjectVector.getScore())
                .organization(organizationDto)
                .foundDate(foundObjectVector.getFoundDate())
                .build();
    }

    /**
     * Este método retorna todos los objetos encontrados en una organización que aún no han sido devueltos.
     * **/
    public FoundObjectsListDto getAllUnreturnedFoundObjectsByOrganization(SimilarObjectsCommand command){
        /* Pedimos a ChatGPT que nos genere un vector a partir de un string vacío. El motivo por el que no hardcodeamos
            un vector con "0" en todas sus componentes es que si en el futuro cambiamos la dimensionalidad de los
            vectores de Pinecone, y nos olvidamos de  modificar esta parte del código acordemente, el mismo fallaría
            y punto de falla no sería tan fácil de detectar.
        * */
        List<Float> embeddings = embeddingService.getTextVectorRepresentation(" ");
        FoundObjectStructVector vector = FoundObjectStructVector.builder()
                .text(" ")
                .embeddings(embeddings)
                .build();

        /* Definimos un filtro para la organización y para que sólo se consideren aquellos objetos que aún no han sido
            devueltos. */
        Struct.Builder filter = Struct.newBuilder();
        if(command.getOrganizationId() != null){
            filter.putFields("organization_id",
                    Value.newBuilder().setStringValue(
                            String.valueOf(command.getOrganizationId())).build());
        }
        filter.putFields("was_returned", Value.newBuilder().setBoolValue(Boolean.valueOf(false)).build());

        // Hacemos la query a Pinecone con el vector y el filtro anteriores.
        List<FoundObjectStructVector> foundObjectVectors = foundObjectVectorStorage.queryVector(vector,
                10000, filter.build()); //TODO: paginado...

        // A partir de la response, acá se elabora la lista que el método devolverá.
        List<FoundObjectDto> foundObjectDtos = foundObjectVectors.parallelStream()
                .map(this::foundObjectToDto)
                .toList();

        return FoundObjectsListDto.builder()
                .foundObjects(foundObjectDtos)
                .build();
    }
}
