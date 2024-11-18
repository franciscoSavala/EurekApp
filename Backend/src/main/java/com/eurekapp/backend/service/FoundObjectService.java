package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.FoundObjectDto;
import com.eurekapp.backend.dto.OrganizationDto;
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
import com.eurekapp.backend.repository.IUserRepository;
import com.eurekapp.backend.repository.ObjectStorage;
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
    private final OrganizationService organizationService;
    private final LostObjectService lostObjectService;
    private final ExecutorService executorService;

    private final IOrganizationRepository organizationRepository;
    private final FoundObjectRepository foundObjectRepository;
    private final IUserRepository userRepository;

    public FoundObjectService(ObjectStorage s3Service,
                              ImageDescriptionService descriptionService,
                              EmbeddingService embeddingService,
                              IOrganizationRepository organizationRepository,
                              OrganizationService organizationService,
                              LostObjectService lostObjectService,
                              ExecutorService executorService, FoundObjectRepository foundObjectRepository, IUserRepository userRepository) {
        this.s3Service = s3Service;
        this.descriptionService = descriptionService;
        this.embeddingService = embeddingService;
        this.organizationRepository = organizationRepository;
        this.organizationService = organizationService;
        this.lostObjectService = lostObjectService;
        this.executorService = executorService;
        this.foundObjectRepository = foundObjectRepository;
        this.userRepository = userRepository;
    }

    /* El propósito de este método es postear un objeto encontrado. Toma como parámetros la foto del objeto encontrado,
    *   una descripción textual provista por el usuario, y el ID del establecimiento en el que se encontró, */
    @SneakyThrows
    public FoundObjectUploadedResponseDto uploadFoundObject(UploadFoundObjectCommand command) {


        // Antes de comenzar, generamos de forma aleatoria un ID para el post de objeto encontrado.
        String foundObjectId = UUID.randomUUID().toString();


                    // 1- ORGANIZACIÓN
        // Chequeamos que el ID de organización provisto corresponda a una organización que existe.
        if(command.getOrganizationId() == null
                || !organizationRepository.existsById(command.getOrganizationId()))
            throw new NotFoundException("org_not_found", String.format("Organization with id '%d' not found", command.getOrganizationId()));
        if(command.getFoundDate().isAfter(LocalDateTime.now()))
            throw new BadRequestException(ValidationError.FOUND_DATE_ERROR);


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
                // Sumamos 10 puntos al usuario que lo devolvió e incrementamos la cuenta de objetos devueltos
                objectFinderUser.setXP( objectFinderUser.getXP()+10 );
                objectFinderUser.setReturnedObjects( objectFinderUser.getReturnedObjects()+1 );
            }else{
                // Si el contenido de username no es vacío, pero tampoco válido, lanzamos una excepción.
                throw new NotFoundException("user_not_found", String.format("El usuario con email '%s' no existe", command.getObjectFinderUsername()));
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
            Organization org = organizationRepository.findById(command.getOrganizationId()).get();
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
        String textRepresentation = descriptionService.getImageTextRepresentation(imageBytes);



                    // 6- GENERACIÓN DEL VECTOR
        /*
        *   Solicitamos a "OpenAI Embeddings" una representación vectorial de la concatenación de la
        *   descripción textual que nos dio "OpenAiChat Completion", y de la descripción y título provistos por el
        *   usuario.
        */
        List<Float> embeddings = embeddingService.getTextVectorRepresentation(textRepresentation +" "+ command.getDetailedDescription() +" "+ command.getTitle());


                    // 7- CREACIÓN DEL FOUNDOBJECT Y PERSISTENCIA DEL MISMO
        FoundObject foundObject = FoundObject.builder()
                .uuid(foundObjectId)
                .title(command.getTitle())
                .objectFinderUser(objectFinderUser)
                .humanDescription(command.getDetailedDescription())
                .aiDescription(textRepresentation)
                .embeddings(embeddings)
                .organizationId(String.valueOf(command.getOrganizationId()))
                .foundDate(command.getFoundDate())
                .coordinates(GeoCoordinates.builder().latitude(objectLatitude).longitude(objectLongitude).build())
                .wasReturned(false)
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


                    // 9- NOTIFICACIONES
        /*
        *   Comparamos el objeto cargado con las publicaciones existentes de objetos perdidos.
        * */
        executorService.execute(() -> lostObjectService.findSimilarLostObject(
                embeddings, command.getOrganizationId(), command.getTitle(), foundObjectId));


        return FoundObjectUploadedResponseDto.builder()
                .textEncoding(textRepresentation)
                .description(command.getTitle())
                .id(foundObjectId)
                .build();
    }

    /**
     *  Ese método es llamado cuando el usuario desea buscar su objeto perdido entre los objetos que están en custodia
     *  de las organizaciones.
     * @param command Objeto que tiene todos los parámetros para que el método haga algo...
     * @return Lista que contiene los objetos encontrados, ordenados por el grado de coincidencia con la búsqueda.
     */
    @SneakyThrows
    public FoundObjectsListDto getFoundObjectByTextDescription(SimilarObjectsCommand command){

        /*
        *  En base a la descripción provista por el usuario, generamos un vector que la represente.
        * */
        List<Float> embeddings = embeddingService.getTextVectorRepresentation(command.getQuery());
        //embeddings = embeddings.stream().map(e->(e*(-1))).toList();

        /*
        *   La intención detrás de inicializar la organización y las coordenadas como null es que siempre le hagamos el
        *   mismo pedido a foundObjectRepository, independientemente de si la búsqueda es en una organización o por
        *   coordenadas.
        *
        *   Si el user está haciendo una búsqueda dentro de una organización, el command tendrá valores null para
        *   la latitud y para la longitud, y tendrá un valor válido para el id de la organización.
        *
        *   Si el user está haciendo una búsqueda por coordenadas, el command tendrá un valor null para el id de
        *   organización, y valores válidos de latitud y de longitud.
        * */

        // Validamos que o se haya provisto una organización, o se hayan provisto coordenadas.
        if(command.getOrganizationId() == null && (command.getLatitude() == null || command.getLongitude() == null))
            throw new ApiException("Api error:", "Invalid parameters", HttpStatus.BAD_REQUEST);

        // Inicializamos la organización como null, y si el usuario proveyó una, usaremos el valor que viene en el
        // command.
        String orgId = null;
        if(command.getOrganizationId() != null){ orgId = command.getOrganizationId().toString();}

        /*
        *   Inicializamos las coordenadas como null. Serán usadas para calcular el score geográfico.
        *   -Si el usuario proveyó coordenadas, usaremos la latitud y longitud que vienen en el command.
        *   -Si el usuario proveyó una organización, usaremos la latitud y longitud de la organización.
        */
        GeoCoordinates queryCoordinates = null;
        if(orgId != null && organizationRepository.existsById(command.getOrganizationId()) ){
            queryCoordinates = organizationRepository.findById(command.getOrganizationId())
                .get()
                .getCoordinates();
        }else{
            queryCoordinates = GeoCoordinates.builder()
                    .latitude(command.getLatitude())
                    .longitude(command.getLongitude())
                    .build();
        }


        /* Le pedimos a FoundObjectRepository que nos devuelva los objetos FoundObject similares al vector, con fecha
        *  posterior a la provista, y que no hayan sido devueltos.
        *  Dependiendo de si la búsqueda es por organización o por coordenadas, u "orgId" o "coordinates" valdrán null.
        * */
        List<FoundObject> foundObjects = foundObjectRepository.query(embeddings,
                                                                    orgId,
                                                                    queryCoordinates,
                                                                    command.getLostDate(),
                                                                    false);

        /*
        *  Llegados a este punto, tenemos todos los objetos encontrados que cumplen con las restricciones de espacio
        *  y tiempo, y conocemos la distancia coseno entre cada uno de estos objetos y la búsqueda.
        *  Para obtener el puntaje total en base al cual ordenaremos los resultados, calcularemos un puntaje
        *  geográfico en base a las coordenadas, y lo combinaremos con la distancia coseno usando MOORA.
        */
        for(FoundObject fo: foundObjects){
            Double cosDistance = fo.getScore().doubleValue();
            cosDistance = (cosDistance <= 0.5) ? 0 : (cosDistance - 0.5) * 2;

            Double geoScore = CommonFunctions.calculateGeoScore(fo.getCoordinates(), queryCoordinates);
            Double distance = CommonFunctions.calculateGeoDistance(fo.getCoordinates(), queryCoordinates);
            Double totalScore = 0.95*cosDistance + 0.05*geoScore;
            log.info(fo.getTitle() + "-" + "cosDistance: " + cosDistance + " - distance: " + distance + " - geoScore: " + geoScore + " - totalScore: " + totalScore);

            // Inicialmente "score" tenía almacenada la distancia coseno. Ahora, la reemplazaremos por el score total.
            fo.setScore(totalScore.floatValue());
            // Agregamos la distancia en metros entre el lugar ingresado por el usuario y el lugar donde se encontró
            // el objeto.
            fo.setDistance(distance.floatValue());
        }


        // Convertimos los FoundObject a FoundObjectDto para poder devolverlos en la respuesta.
        List<FoundObjectDto> result = foundObjects.stream()
                .map(this::foundObjectToDto)
                .sorted(Comparator.comparing(FoundObjectDto::getScore).reversed())
                .toList();

        return FoundObjectsListDto.builder()
                .foundObjects(result)
                .build();
    }

    /*
    * Método usado para que un usuario organizacional pueda ver una lista de todos los objetos que su organización
    * ya ha devuelto.
    * */
    public FoundObjectsListDto getAllReturnedFoundObjectsByOrganization(UserEurekapp user){

        // Obtenemos la organización a partir del usuario.
        Organization org = user.getOrganization();
        String orgId = org.getId().toString();

        // Obtenemos todos los objetos devueltos de la organización.
        List<FoundObject> foundObjects = foundObjectRepository.query(null, orgId, null, null, true);

        // Creamos los DTOs y los metemos en una lista
        List<FoundObjectDto> dtos = foundObjects.stream()
                .map(this::foundObjectToDto)
                .sorted(Comparator.comparing(FoundObjectDto::getFoundDate).reversed())
                .toList();

        return FoundObjectsListDto.builder()
                .foundObjects(dtos)
                .build();
    }

    public FoundObjectDto getFoundObjectDetail(FoundObjectDetailCommand command){
        String foundObjectUuid = command.getFoundObjectUUID();
        FoundObject fo = foundObjectRepository.getByUuid(foundObjectUuid);
        if(fo == null){ throw new BadRequestException("found_object_detail", String.format("Found object with uuid '%s' not found", foundObjectUuid)); }
        return foundObjectToDto(fo);
    }

    private FoundObjectDto foundObjectToDto(FoundObject foundObject) {
        byte[] imageBytes = s3Service.getObjectBytes(foundObject.getUuid());
        log.info("[api_method:GET] [service:S3] Retrieving {}, Bytes processed: {}",
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
                .humanDescription(foundObject.getHumanDescription())
                .aiDescription((foundObject.getAiDescription()))
                .b64Json(Base64.getEncoder().encodeToString(imageBytes))
                .score(foundObject.getScore())
                .distance(foundObject.getDistance())
                .organization(organizationDto)
                .foundDate(foundObject.getFoundDate())
                .latitude(foundObject.getCoordinates().getLatitude().floatValue())
                .longitude(foundObject.getCoordinates().getLongitude().floatValue())
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
