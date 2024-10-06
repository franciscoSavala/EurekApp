package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.ReturnFoundObjectResponseDto;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.repository.*;
import lombok.SneakyThrows;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class ReturnFoundObjectService {

    private final IOrganizationRepository organizationRepository;
    private final IUserRepository userRepository;
    private final IReturnFoundObjectRepository returnFoundObjectRepository;
    private final FoundObjectRepository foundObjectRepository;

    public ReturnFoundObjectService(IOrganizationRepository organizationRepository,
                                    IUserRepository userRepository,
                                    IReturnFoundObjectRepository returnFoundObjectRepository,
                                    FoundObjectRepository foundObjectRepository){
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
        this.returnFoundObjectRepository = returnFoundObjectRepository;
        this.foundObjectRepository = foundObjectRepository;
    }

    /* El propósito de este método es postear un objeto encontrado. Toma como parámetros la foto del objeto encontrado,
     *   una descripción textual provista por el usuario, y el ID del establecimiento en el que se encontró, */
    @SneakyThrows
    public ReturnFoundObjectResponseDto returnFoundObject(ReturnFoundObjectCommand command)
    {
        // Verificar si la organización existe
        if (command.getOrganizationId() == null || !organizationRepository.existsById(command.getOrganizationId())) {
            throw new NotFoundException("org_not_found", String.format("Organization with id '%d' not found", command.getOrganizationId()));
        }

        // Verificar si el usuario existe
        if (command.getUsername() == null || !userRepository.existsByUsername(command.getUsername())) {
            throw new NotFoundException("user_not_found", String.format("El usuario con email '%s' no existe", command.getUsername()));
        }

        // Obtener el usuario
        UserEurekapp user = userRepository.findByUsername(command.getUsername()).orElseThrow(() ->
                new NotFoundException("user_not_found", String.format("El usuario con email '%s' no existe", command.getUsername()))
        );


        // Verificar si el objeto encontrado existe
        FoundObject foundObject = foundObjectRepository.getByUuid(command.getFoundObjectUUID());
        if (foundObject == null) {
            throw new NotFoundException("found_object_not_found", String.format("Found object with UUID '%s' not found", command.getFoundObjectUUID()));
        }


        // Actualizar el objeto en la BD vectorial para marcarlo como devuelto.
        foundObjectRepository.markAsReturned(command.getFoundObjectUUID());

        // TODO: Des-comentar lo que hay abajo al terminar.

        // Crear y persistir la instancia de ReturnFoundObject
        ReturnFoundObject rfo = new ReturnFoundObject();
        rfo.setIdFoundObject(command.getFoundObjectUUID());
        rfo.setDatetimeOfReturn(LocalDateTime.now());
        rfo.setUserEurekapp(user);
        rfo.setDNI(command.getDNI());
        rfo.setPhoneNumber(command.getPhoneNumber());

        // Guardar el objeto devuelto
        returnFoundObjectRepository.save(rfo);


        return ReturnFoundObjectResponseDto.builder()
                .id(String.valueOf(rfo.getId()))
                .username(command.getUsername())
                .DNI(command.getDNI())
                .foundObjectId(foundObject.getUuid())
                .returnDateTime(rfo.getDatetimeOfReturn().toString())
                .phoneNumber(command.getPhoneNumber())
                .build();
    }

}
