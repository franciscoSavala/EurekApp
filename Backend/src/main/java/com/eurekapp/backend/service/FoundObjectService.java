package com.eurekapp.backend.service;

import com.eurekapp.backend.util.TextNormalizer;
import com.eurekapp.backend.dto.FoundObjectDto;
import com.eurekapp.backend.dto.FoundObjectsListDto;
import com.eurekapp.backend.dto.command.FoundObjectDetailCommand;
import com.eurekapp.backend.dto.response.FoundObjectUploadedResponseDto;
import com.eurekapp.backend.exception.ApiException;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.exception.ValidationError;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.repository.FoundObjectRepository;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.IRewardExclusionRepository;
import com.eurekapp.backend.repository.IReturnFoundObjectRepository;
import com.eurekapp.backend.repository.IUserRepository;
import com.eurekapp.backend.repository.ObjectStorage;
import com.eurekapp.backend.service.client.EmbeddingService;
import com.eurekapp.backend.service.client.ImageClassificationService;
import com.eurekapp.backend.service.client.TextClassificationService;
import com.eurekapp.backend.service.client.ImageDescriptionService;
import com.eurekapp.backend.service.client.ImageEmbeddingService;
import com.eurekapp.backend.service.notification.NotificationService;
import lombok.SneakyThrows;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;


import java.time.Clock;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.stream.Collectors;


@Service
public class FoundObjectService implements IFoundObjectService {
    private static final int GRACE_HOURS = 6;

    private static final Set<Role> INCOMPATIBLE_ROLES = Set.of(
            Role.ORGANIZATION_EMPLOYEE, Role.ENCARGADO, Role.ORGANIZATION_OWNER);

    private static final Logger log = LoggerFactory.getLogger(FoundObjectService.class);

    private final ObjectStorage s3Service;
    private final ImageDescriptionService descriptionService;
    private final EmbeddingService embeddingService;
    private final ImageEmbeddingService imageEmbeddingService;
    private final ImageClassificationService imageClassificationService;
    /** EU-337: clasificador de categoría por TEXTO, que tiene PRECEDENCIA sobre el de la foto. */
    private final TextClassificationService textClassificationService;
    private final LostObjectService lostObjectService;
    private final ExecutorService executorService;

    private final IOrganizationRepository organizationRepository;
    private final FoundObjectRepository foundObjectRepository;
    private final IUserRepository userRepository;
    private final IRewardExclusionRepository rewardExclusionRepository;
    /** EU-348: la fecha de devolución vive acá, no en Weaviate junto al resto del objeto. */
    private final IReturnFoundObjectRepository returnFoundObjectRepository;
    private final NotificationService notificationService;
    private final EmailTemplateService emailTemplateService;
    private final FraudBlockService fraudBlockService;
    private final FoundObjectDtoMapper dtoMapper;
    private final StoragePeriodService storagePeriodService;
    private final Clock clock;

    public FoundObjectService(ObjectStorage s3Service,
                              ImageDescriptionService descriptionService,
                              EmbeddingService embeddingService,
                              ImageEmbeddingService imageEmbeddingService,
                              ImageClassificationService imageClassificationService,
                              TextClassificationService textClassificationService,
                              IOrganizationRepository organizationRepository,
                              LostObjectService lostObjectService,
                              ExecutorService executorService,
                              FoundObjectRepository foundObjectRepository,
                              IUserRepository userRepository,
                              IRewardExclusionRepository rewardExclusionRepository,
                              IReturnFoundObjectRepository returnFoundObjectRepository,
                              NotificationService notificationService,
                              EmailTemplateService emailTemplateService,
                              FraudBlockService fraudBlockService,
                              FoundObjectDtoMapper dtoMapper,
                              StoragePeriodService storagePeriodService,
                              Clock clock) {
        this.s3Service = s3Service;
        this.descriptionService = descriptionService;
        this.embeddingService = embeddingService;
        this.imageEmbeddingService = imageEmbeddingService;
        this.imageClassificationService = imageClassificationService;
        this.textClassificationService = textClassificationService;
        this.organizationRepository = organizationRepository;
        this.lostObjectService = lostObjectService;
        this.executorService = executorService;
        this.foundObjectRepository = foundObjectRepository;
        this.userRepository = userRepository;
        this.rewardExclusionRepository = rewardExclusionRepository;
        this.returnFoundObjectRepository = returnFoundObjectRepository;
        this.notificationService = notificationService;
        this.emailTemplateService = emailTemplateService;
        this.fraudBlockService = fraudBlockService;
        this.dtoMapper = dtoMapper;
        this.storagePeriodService = storagePeriodService;
        this.clock = clock;
    }

    /* El propósito de este método es postear un objeto encontrado. Toma como parámetros la foto del objeto encontrado,
    *   una descripción textual provista por el usuario, y el ID del establecimiento en el que se encontró, */
    @SneakyThrows
    public FoundObjectUploadedResponseDto uploadFoundObject(UploadFoundObjectCommand command) {


        // Antes de comenzar, generamos de forma aleatoria un ID para el post de objeto encontrado.
        String foundObjectId = UUID.randomUUID().toString();


                    // 1- ORGANIZACIÓN
        // Chequeamos que el ID de organización provisto corresponda a una organización que existe.
        final Organization organization = command.getOrganizationId() == null ? null
                : organizationRepository.findById(command.getOrganizationId()).orElse(null);
        if(organization == null)
            throw new BadRequestException("org_not_found", String.format("Organization with id '%d' not found", command.getOrganizationId()));
        if(command.getFoundDate().isAfter(LocalDateTime.now()))
            throw new BadRequestException(ValidationError.FOUND_DATE_ERROR);
        // EU-443: la anotación @Length del controlador no se ejecuta (no está @Validated), así que el largo se controla acá.
        if(command.getTitle() != null && command.getTitle().length() > 100)
            throw new BadRequestException("title_too_long", "El título no puede superar los 100 caracteres");


                    //2- USUARIO QUE TRAJO EL OBJETO
        // Primero inicializamos el usuario como "null", porque ingresar el usuario que encontró el objeto es opcional.
        UserEurekapp objectFinderUser = null;
        // Luego verificamos si un usuario fue provisto.
        if(command.getObjectFinderUsername() != null && !command.getObjectFinderUsername().isEmpty() ){
            // Si estamos aquí, es porque hay ALGO en el campo username del command.

            // Ahora verificamos si el contenido de username corresponde al correo de un usuario existente.
            if(userRepository.existsByUsername(command.getObjectFinderUsername())){
                // Obtenemos el usuario
                objectFinderUser = userRepository.getByUsername(command.getObjectFinderUsername());
            }else{
                // Si el contenido de username no es vacío, pero tampoco válido, lanzamos una excepción.
                throw new NotFoundException("user_not_found", String.format("No se encontró el usuario con el username %s", command.getObjectFinderUsername()));
            }
        }

        // Validación de bloqueo (EU-286): un finder bloqueado por sospecha de fraude no puede
        // depositar objetos en la organización.
        if (objectFinderUser != null) {
            Optional<String> finderBlockMessage = fraudBlockService.describeActiveUserBlock(
                    objectFinderUser.getId(), "Quien encontró este objeto");
            if (finderBlockMessage.isPresent()) {
                throw new BadRequestException("finder_blocked", finderBlockMessage.get());
            }
        }



                    // 3- PROCESAMIENTO DE LAS COORDENADAS
        /*
        *  Coordenadas:
        *   -Si se ingresaron coordenadas, se usan esas.
        *   -Si no se ingresaron coordenadas, se usan las coordenadas de la organización, porque eso significa que el
        *       objeto fue encontrado dentro del establecimiento.
        * */
        Double objectLatitude = null;
        Double objectLongitude = null;
        if (command.getLatitude() != null && command.getLongitude() != null){
            objectLatitude = command.getLatitude();
            objectLongitude = command.getLongitude();
        } else {
            // Llegados a esta instancia, la organización si o sí existe, así que no chequeamos que exista antes de obtenerla.
            Organization org = organization;
            objectLatitude = org.getCoordinates().getLatitude();
            objectLongitude = org.getCoordinates().getLongitude();
        }



                    // 5- PROCESAMIENTO DE LA IMAGEN
        // Convertimos la foto en bytes, para poder enviarla en una request.
        final byte[] imageBytes = command.getImage().getBytes();
            //TODO: implementar alguna forma para disminuir la calidad de la imagen si es muy grande
        // Guardamos la imagen en Amazon S3
        Future<Void> uploadImageFuture = (Future<Void>) executorService.submit(() -> s3Service.putObject(imageBytes, foundObjectId));
        // Ahora solicitamos a "OpenAI Chat Completion" una descripción textual de la foto.
        // Deshabilitado temporalmente: la descripción por IA (gpt-4o) es lo que más tokens de OpenAI consume.
        // Se fuerza a string vacío para no romper la carga mientras se migra el algoritmo de búsqueda a CLIP.
        // String textRepresentation = descriptionService.getImageTextRepresentation(imageBytes);
        String textRepresentation = "";



                    // 6- GENERACIÓN DEL VECTOR
        /*
        *   Solicitamos a "OpenAI Embeddings" una representación vectorial de la concatenación de la
        *   descripción textual que nos dio "OpenAiChat Completion", y de la descripción y título provistos por el
        *   usuario.
        */
        // EU-142: el texto se NORMALIZA antes de vectorizar (minúsculas, tildes, formato de identificadores)
        // para que el mismo dato escrito distinto coincida. Se normaliza SÓLO lo que alimenta el vector;
        // título/descripción se persisten y se muestran tal cual los escribió el usuario.
        String textRepresentationNormalized = TextNormalizer.normalize(
                textRepresentation +" "+ command.getDetailedDescription() +" "+ command.getTitle());
        List<Float> embeddings = embeddingService.getTextVectorRepresentation(textRepresentationNormalized);

        // EU-324: vector VISUAL de la imagen (CLIP, foto → vector directo) para el vector nombrado "image",
        // y clasificación por IA en categorías duras (define α/β y es filtro previo del matching). La
        // categoría la determina la IA: sobrescribe cualquier valor que venga del usuario.
        List<Float> imageEmbedding = imageEmbeddingService.getImageVectorRepresentation(imageBytes);
        /* EU-337: MISMA regla de precedencia que en la búsqueda (texto primero, foto si el texto se
         * abstiene). Tiene que ser la misma de los dos lados: el filtro por categoría es DURO, así que
         * si el alta clasificara por foto y la búsqueda por texto, un par podría caer en categorías
         * distintas y no compararse nunca —sin que nadie se entere—. */
        ObjectCategory textCategory = textClassificationService.classify(
                command.getTitle() + " " + command.getDetailedDescription());
        ObjectCategory category = textCategory != null ? textCategory : imageClassificationService.classify(imageBytes);


                    // 7- CREACIÓN DEL FOUNDOBJECT Y PERSISTENCIA DEL MISMO
        FoundObject foundObject = FoundObject.builder()
                .uuid(foundObjectId)
                .title(command.getTitle())
                .objectFinderUser(objectFinderUser)
                .humanDescription(command.getDetailedDescription())
                // EU-324: dos vectores nombrados: "text" (OpenAI, título+descripción) e "image" (CLIP, foto).
                .textEmbedding(embeddings)
                .imageEmbedding(imageEmbedding)
                .organizationId(String.valueOf(command.getOrganizationId()))
                .foundDate(command.getFoundDate())
                .coordinates(GeoCoordinates.builder().latitude(objectLatitude).longitude(objectLongitude).build())
                .wasReturned(false)
                // Categoría dura determinada por IA desde la imagen (no la elige el usuario).
                .category(category.name())
                .build();
        Future<Void> addFuture = (Future<Void>) executorService.submit(() -> foundObjectRepository.add(foundObject));

                    // 8- EJECUCIÓN DE TAREAS ASÍNCRONAS
        try {
            addFuture.get();
            uploadImageFuture.get();
            if(objectFinderUser != null){ userRepository.saveAndFlush(objectFinderUser); }
            // Asentamos la operación en el log.
            log.info("[api_method:POST] [service:S3] Bytes processed: {}", imageBytes.length);
        } catch (ExecutionException | InterruptedException e){
            log.error(e.toString());
            throw new ApiException("upload_error", "There was an error uploading your object", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        // Si el finder tiene rol incompatible, registrar exclusión de puntos al momento de la carga
        if (objectFinderUser != null && INCOMPATIBLE_ROLES.contains(objectFinderUser.getRole())) {
            rewardExclusionRepository.save(RewardExclusion.builder()
                    .foundObjectUUID(foundObjectId)
                    .user(objectFinderUser)
                    .userRole(objectFinderUser.getRole())
                    .reason("INCOMPATIBLE_ROLE")
                    .excludedAt(LocalDateTime.now())
                    .organization(organization)
                    .build());
            log.info("Reward excluded at upload for finder id={} role={} uuid={}",
                    objectFinderUser.getId(), objectFinderUser.getRole(), foundObjectId);
        }

                    // 9- NOTIFICACIONES
        /*
        *   Búsqueda INVERSA (EU-279): comparamos el objeto encontrado contra las búsquedas guardadas
        *   existentes y notificamos a los dueños cuyas búsquedas coinciden. Le pasamos el FoundObject
        *   completo para puntuar con el MISMO algoritmo que la búsqueda regular (texto + geografía).
        * */
        executorService.execute(() -> {
            try {
                lostObjectService.notifyMatchingSavedSearches(foundObject);
            } catch (RuntimeException e) {
                // El objeto ya quedó cargado: un fallo del aviso (p. ej. la base de vectores) no lo deshace.
                log.error("No se pudo completar el aviso de coincidencias del objeto {}", foundObjectId, e);
            }
        });

        // Email de agradecimiento al finder (solo si es usuario EurekApp registrado)
        if (objectFinderUser != null) {
            try {
                Organization finderOrg = organization;
                notificationService.sendNotification(
                        objectFinderUser.getUsername(),
                        "¡Gracias por tu colaboración! — EurekApp",
                        emailTemplateService.buildObjectReceivedEmail(
                                objectFinderUser.getFirstName(),
                                command.getTitle(),
                                finderOrg.getName()));
            } catch (Exception e) {
                log.warn("No se pudo enviar email de agradecimiento al finder {}: {}",
                        objectFinderUser.getUsername(), e.getMessage());
            }
        }


        return FoundObjectUploadedResponseDto.builder()
                .textEncoding(textRepresentation)
                .description(command.getTitle())
                .id(foundObjectId)
                .build();
    }

    private static final int MAX_RETURNED_SHOWN = 50;

    /*
    * Método usado para que un usuario organizacional pueda ver una lista de todos los objetos que su organización
    * ya ha devuelto.
    * */
    public FoundObjectsListDto getAllReturnedFoundObjectsByOrganization(UserEurekapp user){

        // Obtenemos la organización a partir del usuario.
        Organization org = user.getOrganization();

        // EU-441: la fecha de devolución vive en MySQL, no en Weaviate. Se piden primero las devoluciones más
        // recientes de la organización (ya ordenadas por fecha, con un tope) y recién después sus objetos.
        // Antes se pedían los objetos a Weaviate, que sin orden devuelve apenas 25: la última devolución
        // podía quedar afuera. Y traer todos los objetos para ordenarlos y quedarse con unos pocos era lento.
        List<ReturnFoundObject> recientes = returnFoundObjectRepository.findMostRecentByOrganization(
                org.getId(), PageRequest.of(0, MAX_RETURNED_SHOWN));
        Map<String, FoundObject> objetos = foundObjectRepository.getByUuids(
                recientes.stream().map(ReturnFoundObject::getFoundObjectUUID).toList());

        var organizacion = dtoMapper.toPublicOrganization(org);
        List<FoundObjectDto> dtos = recientes.stream()
                .filter(rfo -> objetos.containsKey(rfo.getFoundObjectUUID()))
                .map(rfo -> {
                    FoundObjectDto dto = dtoMapper.toDto(objetos.get(rfo.getFoundObjectUUID()), organizacion);
                    dto.setReturnDate(rfo.getDatetimeOfReturn());
                    return dto;
                })
                .toList();

        return FoundObjectsListDto.builder()
                .foundObjects(dtos)
                .build();
    }

    public FoundObjectDto getFoundObjectDetail(FoundObjectDetailCommand command){
        String foundObjectUuid = command.getFoundObjectUUID();
        FoundObject fo = foundObjectRepository.getByUuid(foundObjectUuid);
        if(fo == null){ throw new BadRequestException("found_object_detail", String.format("Found object with uuid '%s' not found", foundObjectUuid)); }
        FoundObjectDto dto = dtoMapper.toDto(fo);
        fillStorage(dto, fo, storagePeriodService.getMaxStorageDays(fo.getOrganizationId()));
        return dto;
    }

    /* EU-452: completa estado y vencimiento del plazo de guarda en el DTO. */
    private void fillStorage(FoundObjectDto dto, FoundObject fo, Integer maxStorageDays) {
        dto.setStorageStatus(storagePeriodService.getStatus(fo, maxStorageDays));
        dto.setStorageExpiresAt(storagePeriodService.getExpirationDate(fo, maxStorageDays));
    }

    /**
     * Este método retorna todos los objetos encontrados en una organización que aún no han sido devueltos.
     * **/
    public FoundObjectsListDto getAllUnreturnedFoundObjectsByOrganization(SimilarObjectsCommand command){
        String orgId;
        if(command.getOrganizationId() != null){ orgId = command.getOrganizationId().toString();}
        else{ throw new IllegalArgumentException("ERROR: Se debe proveer un ID de organización."); }

        int page = command.getPage() != null ? command.getPage() : 0;
        int pageSize = command.getPageSize() != null ? command.getPageSize() : 20;
        int offset = page * pageSize;

        Integer maxStorageDays = storagePeriodService.getMaxStorageDays(orgId);
        LocalDateTime foundDateTo = null;
        if (Boolean.TRUE.equals(command.getExpiredOnly())) {
            if (maxStorageDays == null) {
                return FoundObjectsListDto.builder()
                        .foundObjects(List.of())
                        .hasMore(false)
                        .build();
            }
            foundDateTo = LocalDateTime.now(clock).minusDays(maxStorageDays);
        }

        // Pedimos pageSize+1 para saber si hay más sin hacer una query extra de conteo.
        List<FoundObject> foundObjects = foundObjectRepository.query(null,
                orgId,
                null,
                null,
                foundDateTo,
                false,
                null,
                pageSize + 1,
                offset);

        boolean hasMore = foundObjects.size() > pageSize;
        List<FoundObjectDto> result = foundObjects.stream()
                .limit(pageSize)
                .map(fo -> {
                    FoundObjectDto dto = dtoMapper.toDto(fo);
                    fillStorage(dto, fo, maxStorageDays);
                    return dto;
                })
                .toList();

        return FoundObjectsListDto.builder()
                .foundObjects(result)
                .hasMore(hasMore)
                .build();
    }
}
