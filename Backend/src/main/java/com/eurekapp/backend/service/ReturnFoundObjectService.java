package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.ReturnFoundObjectDto;
import com.eurekapp.backend.dto.response.RewardExclusionDto;
import com.eurekapp.backend.dto.response.RewardExclusionListDto;
import com.eurekapp.backend.exception.ApiException;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.ForbiddenException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.repository.*;
import com.eurekapp.backend.service.notification.NotificationService;
import lombok.SneakyThrows;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import jakarta.transaction.Transactional;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;

@Service
public class ReturnFoundObjectService {

    private static final Logger log = LoggerFactory.getLogger(FoundObjectService.class);
    private static final DateTimeFormatter DISPLAY_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final Map<String, String> ROLE_LABELS = Map.of(
            "ORGANIZATION_EMPLOYEE", "Empleado",
            "ENCARGADO", "Encargado",
            "ORGANIZATION_OWNER", "Responsable"
    );


    private final IOrganizationRepository organizationRepository;
    private final IUserRepository userRepository;
    private final IReturnFoundObjectRepository returnFoundObjectRepository;
    private final FoundObjectRepository foundObjectRepository;
    private final ObjectStorage s3Service;
    private final ExecutorService executorService;
    private final NotificationService notificationService;
    private final IReclamoRepository reclamoRepository;
    private final IReclamoHistoryRepository reclamoHistoryRepository;
    private final IRewardExclusionRepository rewardExclusionRepository;
    private final InAppNotificationService inAppNotificationService;

    public ReturnFoundObjectService(IOrganizationRepository organizationRepository,
                                    IUserRepository userRepository,
                                    IReturnFoundObjectRepository returnFoundObjectRepository,
                                    FoundObjectRepository foundObjectRepository, ObjectStorage s3Service,
                                    ExecutorService executorService, NotificationService notificationService,
                                    IReclamoRepository reclamoRepository,
                                    IReclamoHistoryRepository reclamoHistoryRepository,
                                    IRewardExclusionRepository rewardExclusionRepository,
                                    InAppNotificationService inAppNotificationService){
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
        this.returnFoundObjectRepository = returnFoundObjectRepository;
        this.foundObjectRepository = foundObjectRepository;
        this.s3Service = s3Service;
        this.executorService = executorService;
        this.notificationService = notificationService;
        this.reclamoRepository = reclamoRepository;
        this.reclamoHistoryRepository = reclamoHistoryRepository;
        this.rewardExclusionRepository = rewardExclusionRepository;
        this.inAppNotificationService = inAppNotificationService;
    }

    /* El propósito de este método es postear un objeto encontrado. Toma como parámetros la foto del objeto encontrado,
     *   una descripción textual provista por el usuario, y el ID del establecimiento en el que se encontró, */
    @SneakyThrows
    public ReturnFoundObjectDto returnFoundObject(ReturnFoundObjectCommand command, UserEurekapp caller)
    {
        if(command.getDNI() == null || command.getPhoneNumber() == null || command.getPhoneNumber().isEmpty()){
            throw new BadRequestException("incomplete_data", "");
        }
                        // 1- ORGANIZACIÓN
        // Verificamos si la organización existe
        if (command.getOrganizationId() == null || !organizationRepository.existsById(command.getOrganizationId())) {
            throw new NotFoundException("org_not_found", String.format("Organization with id '%d' not found", command.getOrganizationId()));
        }
        // Verificamos que el llamante pertenezca a la organización
        if (caller == null || caller.getOrganization() == null
                || !caller.getOrganization().getId().equals(command.getOrganizationId())) {
            throw new ForbiddenException("unauthorized", "No pertenece a esta organización");
        }



                        // 2- USUARIO
        // Primero inicializamos el usuario como "null", porque es opcional.
        UserEurekapp user = null;

        // Luego verificamos si un usuario fue provisto.
        if(command.getUsername() != null && !command.getUsername().isEmpty() ){
            // Si estamos aquí, es porque hay ALGO en el campo username del command.

            // Ahora verificamos si el contenido de username corresponde al correo de un usuario existente.
            if(userRepository.existsByUsername(command.getUsername())){
                // Obtenemos el usuario
                user = userRepository.getByUsername(command.getUsername());
            }else{
                // Si el contenido de username no es vacío, pero tampoco válido, lanzamos una excepción.
                throw new NotFoundException("user_not_found", String.format("El usuario con email '%s' no existe", command.getUsername()));
            }

            // Verificamos que el usuario tenga un reclamo previo sobre este objeto
            boolean hasPriorClaim = reclamoRepository
                    .findByFoundObjectUUIDAndUser_Id(
                            command.getFoundObjectUUID(),
                            user.getId()
                    ).isPresent();
            if (!hasPriorClaim) {
                throw new BadRequestException("no_prior_claim",
                        "El usuario no posee un reclamo previo asociado a este objeto");
            }
        }



                        // 3- UPDATE DE FOUND_OBJECT EN LA BD VECTORIAL
        // Verificamos si el objeto encontrado existe
        FoundObject foundObject = foundObjectRepository.getByUuid(command.getFoundObjectUUID());
        if (foundObject == null) {
            throw new NotFoundException("found_object_not_found", String.format("FoundObject with UUID '%s' not found", command.getFoundObjectUUID()));
        }
        // Verificamos que este objeto no haya sido devuelto aún
        if(foundObject.getWasReturned()){
            throw new BadRequestException("found_object", String.format("Found object with UUID '%s' was already returned", command.getFoundObjectUUID()));
        }
        // Actualizamos el objeto en la BD vectorial para marcarlo como devuelto.
        //foundObjectRepository.markAsReturned(command.getFoundObjectUUID());
        Future<Void> updateFoundObjectFuture = (Future<Void>) executorService.submit(() -> foundObjectRepository.markAsReturned(command.getFoundObjectUUID()));



                        // 4- INSERT DE FOTO DE QUIEN SE LLEVA EL OBJETO
        // Generamos de forma aleatoria un ID para la foto de la persona que se lleva el objeto.
        String personPhotoUUID = UUID.randomUUID().toString();
        // Convertimos la foto en bytes, para poder enviarla en una request.
        final byte[] imageBytes = command.getImage().getBytes();
        Future<Void> uploadImageFuture = (Future<Void>) executorService.submit(() -> s3Service.putObject(imageBytes,personPhotoUUID));



                        // 5- CREACIÓN DE LA TRANSACCIÓN DE DEVOLUCIÓN E INSERT EN LA BD RELACIONAL
        // Crear y persistir la instancia de ReturnFoundObject
        ReturnFoundObject rfo = new ReturnFoundObject();
        rfo.setFoundObjectUUID(command.getFoundObjectUUID());
        rfo.setDatetimeOfReturn(LocalDateTime.now());
        rfo.setUserEurekapp(user);
        rfo.setDNI(command.getDNI());
        rfo.setPhoneNumber(command.getPhoneNumber());
        rfo.setPersonPhotoUUID(personPhotoUUID);
        // Guardar el objeto devuelto
        //returnFoundObjectRepository.save(rfo);
        Future<ReturnFoundObject> saveReturnFoundObjectFuture = (Future<ReturnFoundObject>) executorService.submit(() -> returnFoundObjectRepository.save(rfo));



                    // 6- EJECUCIÓN ASÍNCRONA DE LAS TRANSACCIONES
        // Ejecutamos las transacciones de forma asíncrona
        try {
            uploadImageFuture.get();
            saveReturnFoundObjectFuture.get();
            updateFoundObjectFuture.get();
        } catch (ExecutionException | InterruptedException e){
            log.error(e.toString());
            throw new ApiException("upload_error", "There was an error registering the return of the object", HttpStatus.INTERNAL_SERVER_ERROR);
        }

                        // 6b- ACTUALIZAR STATUS DEL RECLAMO A DEVUELTO
        List<Reclamo> reclamosDelObjeto =
                reclamoRepository.findByFoundObjectUUID(command.getFoundObjectUUID());
        for (Reclamo r : reclamosDelObjeto) {
            if (r.getStatus() == ClaimStatus.DEVUELTO || r.getStatus() == ClaimStatus.RECHAZADO) continue;
            ReclamoHistory h = ReclamoHistory.builder()
                    .reclamo(r)
                    .previousStatus(r.getStatus())
                    .newStatus(ClaimStatus.DEVUELTO)
                    .changedBy(null)
                    .changedAt(LocalDateTime.now())
                    .note("Objeto retirado")
                    .build();
            reclamoHistoryRepository.save(h);
            r.setStatus(ClaimStatus.DEVUELTO);
            r.setUpdatedAt(LocalDateTime.now());
            reclamoRepository.save(r);
        }

                    // 7- NOTIFICACIÓN AL FINDER + ACTUALIZACIÓN DE XP
        UserEurekapp finderProxy = foundObject.getObjectFinderUser();
        if (finderProxy == null) {
            log.info("Found object {} has no associated finder user, skipping notification", foundObject.getUuid());
        } else {
            try {
                // Usar findById para evitar LazyInitializationException del proxy de getReferenceById
                UserEurekapp finder = userRepository.findById(finderProxy.getId()).orElse(null);
                if (finder == null) {
                    log.warn("Finder user id={} not found in DB", finderProxy.getId());
                } else if (rewardExclusionRepository.existsByFoundObjectUUID(foundObject.getUuid())
                        || (finder.getRole() != null && ROLE_LABELS.containsKey(finder.getRole().name()))) {
                    // Exclusión ya registrada, o rol incompatible sin registro previo (e.g. seed data)
                    log.info("Reward excluded for uuid={}: record exists or incompatible role {}",
                            foundObject.getUuid(), finder.getRole());
                } else {
                    // Guardar el destinatario para posible reprocesamiento futuro
                    rfo.setNotificationRecipient(finder.getUsername());
                    returnFoundObjectRepository.save(rfo);

                    // Actualizar XP y contador
                    finder.setXP(finder.getXP() + 10L);
                    finder.setReturnedObjects(finder.getReturnedObjects() + 1L);
                    userRepository.save(finder);

                    // Enviar email
                    String subject = "¡Tu objeto encontrado fue retirado!";
                    String content = String.format(
                        "<h2>El objeto <b>%s</b> fue devuelto a su dueño.</h2>" +
                        "<p><b>Fecha de devolución:</b> %s</p>" +
                        "<p><b>Registrado por:</b> %s %s</p>" +
                        "<p><b>DNI de quien retiró:</b> %s</p>" +
                        "<p><b>Sumaste 10 puntos por devolver este objeto. ¡Gracias por tu contribución!</b></p>",
                        foundObject.getTitle(),
                        rfo.getDatetimeOfReturn().format(DISPLAY_FORMATTER),
                        finder.getFirstName(), finder.getLastName(),
                        rfo.getDNI()
                    );
                    notificationService.sendNotification(finder.getUsername(), subject, content);
                    rfo.setNotificationSentAt(LocalDateTime.now());
                    returnFoundObjectRepository.save(rfo);

                    inAppNotificationService.createNotification(
                            finder,
                            "¡Obtuviste una recompensa!",
                            "El objeto \"" + foundObject.getTitle() + "\" fue devuelto a su dueño. Sumaste 10 puntos de experiencia.",
                            "REWARD_EARNED",
                            null
                    );
                }
            } catch (Exception e) {
                log.warn("Error en notificación/XP para finder id={}: {}", finderProxy.getId(), e.getMessage());
            }
        }

        return ReturnFoundObjectDto.builder()
                .id(String.valueOf(rfo.getId()))
                .username(command.getUsername())
                .DNI(command.getDNI())
                .foundObjectId(foundObject.getUuid())
                .returnDateTime(rfo.getDatetimeOfReturn())
                .phoneNumber(command.getPhoneNumber())
                .build();
    }


    /**
     * Devuelve todos los casos en que no se otorgó recompensa por incompatibilidad de funciones,
     * para auditoría por parte del responsable de la organización.
     */
    @Transactional
    public RewardExclusionListDto getRewardExclusions(UserEurekapp user) {
        if (user.getRole() != Role.ORGANIZATION_OWNER) {
            throw new ForbiddenException("forbidden", "Solo el responsable de la organización puede consultar exclusiones de recompensa");
        }
        if (user.getOrganization() == null) {
            throw new ForbiddenException("forbidden", "No pertenece a ninguna organización");
        }
        String orgId = user.getOrganization().getId().toString();
        List<RewardExclusion> exclusions = rewardExclusionRepository.findByOrganizationId(orgId);
        List<RewardExclusionDto> dtos = exclusions.stream().map(RewardExclusionDto::from).toList();
        return new RewardExclusionListDto(dtos);
    }

    /*
    * Método usado para obtener una devolución de objeto a partir del id del FoundObject.
    * */
    public ReturnFoundObjectDto getReturnFoundObject(UserEurekapp user, String foundObjectUUID){

        // Obtenemos la objeto ReturnFoundObject
        ReturnFoundObject rfo = returnFoundObjectRepository.findByFoundObjectUUID(foundObjectUUID);
        if (rfo == null) {
            throw new NotFoundException("return_not_found",
                String.format("No return record found for object '%s'", foundObjectUUID));
        }

        // Validamos que el usuario pertenezca a la organización que retiene el objeto. Si no lo es, lanzamos una excepción.
        FoundObject fo = foundObjectRepository.getByUuid(foundObjectUUID);
        if (fo == null) {
            throw new NotFoundException("found_object_not_found",
                String.format("Found object with UUID '%s' not found.", foundObjectUUID));
        }
        if (user.getOrganization() == null) {
            throw new ForbiddenException("no_organization", "User does not belong to any organization.");
        }
        if( !fo.getOrganizationId().equals(user.getOrganization().getId().toString()) ){
            throw new BadRequestException("return_found_object", String.format("Found object with UUID '%s' does not belong to your organization.", foundObjectUUID));
        }

        // Obtenemos la imagen de la persona a la que se devolvió el objeto
        String photoB64 = null;
        try {
            byte[] imageBytes = s3Service.getObjectBytes(rfo.getPersonPhotoUUID());
            if (imageBytes != null) {
                photoB64 = Base64.getEncoder().encodeToString(imageBytes);
            }
        } catch (Exception ignored) {}

        // Como es posible que el usuario sea null, hacemos esta validación.
        String rfoUsername = null;
        if(rfo.getUserEurekapp() != null){rfoUsername = rfo.getUserEurekapp().getUsername();}

        // Datos del finder y motivo de exclusión de recompensa.
        // La exclusión de MySQL es la fuente primaria: evita depender del proxy Hibernate de Weaviate.
        String finderEmail = null;
        String finderFullName = null;
        String finderRole = null;
        Boolean rewardExcluded = null;
        String rewardExclusionMessage = null;

        Optional<RewardExclusion> exclusionOpt = rewardExclusionRepository.findByFoundObjectUUID(foundObjectUUID);
        if (exclusionOpt.isPresent()) {
            RewardExclusion exclusion = exclusionOpt.get();
            UserEurekapp finder = userRepository.findById(exclusion.getUser().getId()).orElse(null);
            if (finder != null) {
                finderEmail = finder.getUsername();
                finderFullName = finder.getFirstName() + " " + finder.getLastName();
                finderRole = exclusion.getUserRole().name();
            }
            rewardExcluded = true;
            String roleLabel = ROLE_LABELS.getOrDefault(exclusion.getUserRole().name(), exclusion.getUserRole().name());
            rewardExclusionMessage = "Sin recompensa de puntos: incompatibilidad de funciones (" + roleLabel + ")";
        } else if (fo.getObjectFinderUser() != null) {
            // Finder sin exclusión registrada: resolverlo desde la BD directamente (evita proxy lazy)
            Long finderId = fo.getObjectFinderUser().getId();
            UserEurekapp finder = finderId != null ? userRepository.findById(finderId).orElse(null) : null;
            if (finder != null) {
                finderEmail = finder.getUsername();
                finderFullName = finder.getFirstName() + " " + finder.getLastName();
                finderRole = finder.getRole() != null ? finder.getRole().name() : null;

                if (finder.getRole() != null && ROLE_LABELS.containsKey(finder.getRole().name())) {
                    // Rol incompatible sin exclusión registrada (e.g. datos de seed insertados por SQL)
                    rewardExcluded = true;
                    String roleLabel = ROLE_LABELS.getOrDefault(finder.getRole().name(), finder.getRole().name());
                    rewardExclusionMessage = "Sin recompensa de puntos: incompatibilidad de funciones (" + roleLabel + ")";
                } else {
                    rewardExcluded = false;
                }
            }
        }

        return ReturnFoundObjectDto.builder()
                .id(String.valueOf(rfo.getId()))
                .username(rfoUsername)
                .DNI(rfo.getDNI())
                .foundObjectId(foundObjectUUID)
                .returnDateTime(rfo.getDatetimeOfReturn())
                .phoneNumber(rfo.getPhoneNumber())
                .personPhoto_b64Json(photoB64)
                .finderEmail(finderEmail)
                .finderFullName(finderFullName)
                .finderRole(finderRole)
                .rewardExcluded(rewardExcluded)
                .rewardExclusionMessage(rewardExclusionMessage)
                .build();
    }
}
