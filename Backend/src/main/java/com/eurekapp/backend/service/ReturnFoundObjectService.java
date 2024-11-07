package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.ReturnFoundObjectDto;
import com.eurekapp.backend.exception.ApiException;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.repository.*;
import lombok.SneakyThrows;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Base64;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;

@Service
public class ReturnFoundObjectService {

    private static final Logger log = LoggerFactory.getLogger(FoundObjectService.class);
    private final IOrganizationRepository organizationRepository;
    private final IUserRepository userRepository;
    private final IReturnFoundObjectRepository returnFoundObjectRepository;
    private final FoundObjectRepository foundObjectRepository;
    private final ObjectStorage s3Service;
    private final ExecutorService executorService;

    public ReturnFoundObjectService(IOrganizationRepository organizationRepository,
                                    IUserRepository userRepository,
                                    IReturnFoundObjectRepository returnFoundObjectRepository,
                                    FoundObjectRepository foundObjectRepository, ObjectStorage s3Service, ExecutorService executorService){
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
        this.returnFoundObjectRepository = returnFoundObjectRepository;
        this.foundObjectRepository = foundObjectRepository;
        this.s3Service = s3Service;
        this.executorService = executorService;
    }

    /* El propósito de este método es postear un objeto encontrado. Toma como parámetros la foto del objeto encontrado,
     *   una descripción textual provista por el usuario, y el ID del establecimiento en el que se encontró, */
    @SneakyThrows
    public ReturnFoundObjectDto returnFoundObject(ReturnFoundObjectCommand command)
    {
        if(command.getDNI() == null || command.getPhoneNumber().isEmpty()){
            throw new BadRequestException("incomplete_data", "");
        }
                        // 1- ORGANIZACIÓN
        // Verificamos si la organización existe
        if (command.getOrganizationId() == null || !organizationRepository.existsById(command.getOrganizationId())) {
            throw new NotFoundException("org_not_found", String.format("Organization with id '%d' not found", command.getOrganizationId()));
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
        }



                        // 3- UPDATE DE FOUND_OBJECT EN LA BD VECTORIAL
        // Verificamos si el objeto encontrado existe
        FoundObject foundObject = foundObjectRepository.getByUuid(command.getFoundObjectUUID());
        if (foundObject == null) {
            throw new NotFoundException("found_object_not_found", String.format("FoundObject with UUID '%s' not found", command.getFoundObjectUUID()));
        }
        // Verificamos que este objeto no haya sido devuelto aún
        FoundObject fo = foundObjectRepository.getByUuid(command.getFoundObjectUUID());
        if(fo.getWasReturned()){
            throw new BadRequestException("found_object", String.format("Found object with UUID '%s' was already returned", command.getFoundObjectUUID()));}
        // Actualizamos el objeto en la BD vectorial para marcarlo como devuelto.
        //foundObjectRepository.markAsReturned(command.getFoundObjectUUID());
        Future<Void> updateFoundObjectFuture = (Future<Void>) executorService.submit(() -> foundObjectRepository.markAsReturned(command.getFoundObjectUUID()));



                        // 4- INSERT DE FOTO DE QUIEN SE LLEVA EL OBJETO
        // Generamos de forma aleatoria un ID para la foto de la persona que se lleva el objeto.
        String personPhotoUUID = UUID.randomUUID().toString();
        // Convertimos la foto en bytes, para poder enviarla en una request.
        final byte[] imageBytes = command.getImage().getBytes();
        s3Service.putObject(imageBytes, personPhotoUUID);
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

        return ReturnFoundObjectDto.builder()
                .id(String.valueOf(rfo.getId()))
                .username(command.getUsername())
                .DNI(command.getDNI())
                .foundObjectId(foundObject.getUuid())
                .returnDateTime(rfo.getDatetimeOfReturn())
                .phoneNumber(command.getPhoneNumber())
                .build();
    }


    /*
    * Método usado para obtener una devolución de objeto a partir del id del FoundObject.
    * */
    public ReturnFoundObjectDto getReturnFoundObject(UserEurekapp user, String foundObjectUUID){

        // Obtenemos la objeto ReturnFoundObject
        ReturnFoundObject rfo = returnFoundObjectRepository.findByFoundObjectUUID(foundObjectUUID);

        // Validamos que el usuario pertenezca a la organización que retiene el objeto. Si no lo es, lanzamos una excepción.
        FoundObject fo = foundObjectRepository.getByUuid(foundObjectUUID);
        if( !fo.getOrganizationId().equals(user.getOrganization().getId().toString()) ){
            throw new BadRequestException("return_found_object", String.format("Found object with UUID '%s' does not belong to your organization.", foundObjectUUID));
        }

        // Obtenemos la imagen de la persona a la que se devolvió el objeto
        byte[] imageBytes = s3Service.getObjectBytes(rfo.getPersonPhotoUUID());

        // Como es posible que el usuario sea null, hacemos esta validación.
        String rfoUsername = null;
        if(rfo.getUserEurekapp() != null){rfoUsername = rfo.getUserEurekapp().getUsername();}

        return ReturnFoundObjectDto.builder()
                .id(String.valueOf(rfo.getId()))
                .username(rfoUsername)
                .DNI(rfo.getDNI())
                .foundObjectId(foundObjectUUID)
                .returnDateTime(rfo.getDatetimeOfReturn())
                .phoneNumber(rfo.getPhoneNumber())
                .personPhoto_b64Json(Base64.getEncoder().encodeToString(imageBytes))
                .build();
    }
}
