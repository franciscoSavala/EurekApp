package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.ReturnFoundObjectResponseDto;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.FoundObjectStructVector;
import com.eurekapp.backend.model.ReturnFoundObject;
import com.eurekapp.backend.model.ReturnFoundObjectCommand;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.IReturnFoundObjectRepository;
import com.eurekapp.backend.repository.IUserRepository;
import com.eurekapp.backend.repository.VectorStorage;
import lombok.SneakyThrows;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class ReturnFoundObjectService {

    private final VectorStorage<FoundObjectStructVector> textPineconeRepository;
    private final IOrganizationRepository organizationRepository;
    private final IUserRepository userRepository;
    private final IReturnFoundObjectRepository returnFoundObjectRepository;

    public ReturnFoundObjectService(VectorStorage<FoundObjectStructVector> textPineconeRepository,
                                    IOrganizationRepository organizationRepository,
                                    IUserRepository userRepository,
                                    IReturnFoundObjectRepository returnFoundObjectRepository){
        this.textPineconeRepository = textPineconeRepository;
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
        this.returnFoundObjectRepository = returnFoundObjectRepository;
    }

    /* El propósito de este método es postear un objeto encontrado. Toma como parámetros la foto del objeto encontrado,
     *   una descripción textual provista por el usuario, y el ID del establecimiento en el que se encontró, */
    @SneakyThrows
    public ReturnFoundObjectResponseDto returnFoundObject(ReturnFoundObjectCommand command)
    {
        if(command.getOrganizationId() == null
                || !organizationRepository.existsById(command.getOrganizationId()))
            throw new NotFoundException("org_not_found", String.format("Organization with id '%d' not found", command.getOrganizationId()));
        if(command.getUsername() == null
                || !userRepository.existsByUsername(command.getUsername()))
            throw new NotFoundException("user_not_found", String.format("User with username '%s' not found", command.getUsername()));

        /* Actualizamos el vector de Pinecone correspondiente al objeto encontrado, para marcarlo como "devuelto",
            es decir, cambiamos "was_returned" a "true". */
        FoundObjectStructVector vector = textPineconeRepository.fetchVector(command.getFoundObjectUUID());
        vector.setWasReturned(true);
        textPineconeRepository.upsertVector(vector);


        // Creamos y persistimos la instancia de ReturnFoundObject (= devolución de objeto perdido).
        UserEurekapp user = userRepository.findByUsername(command.getUsername()).get();
        ReturnFoundObject rfo = new ReturnFoundObject();
        rfo.setIdFoundObject(command.getFoundObjectUUID());
        rfo.setDatetimeOfReturn(LocalDateTime.now());
        rfo.setUserEurekapp(user);
        rfo.setDNI(command.getDNI());
        rfo.setPhoneNumber(command.getPhoneNumber());
        returnFoundObjectRepository.save(rfo);

        return ReturnFoundObjectResponseDto.builder()
                .id(String.valueOf(rfo.getId()))
                .username(command.getUsername())
                .DNI(command.getDNI())
                .foundObjectId(vector.getId())
                .returnDateTime(rfo.getDatetimeOfReturn().toString())
                .phoneNumber(command.getPhoneNumber())
                .build();
    }

}
