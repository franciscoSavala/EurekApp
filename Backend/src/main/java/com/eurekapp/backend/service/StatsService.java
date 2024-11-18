package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.response.StatsResponseDto;
import com.eurekapp.backend.model.FoundObject;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.FoundObjectRepository;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.IUserRepository;
import lombok.AllArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

@AllArgsConstructor
@Service
public class StatsService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);
    private FoundObjectRepository foundObjectRepository;
    private IOrganizationRepository organizationRepository;
    private IUserRepository userRepository;

    /*
    *  Método usado para obtener las estadísticas de la aplicación.
    * */
    public StatsResponseDto getStats(){

        List<Organization> organizationsList = organizationRepository.findAll();
        Long organizations = ((Integer) organizationsList.size()).longValue();

        List<UserEurekapp> usersList = userRepository.findAll();
        Long users = ((Integer) usersList.size()).longValue();
        Long orgOwnerUsers = 0L;
        Long orgEmployeesUsers = 0L;
        Long regularUsers = 0L;
        for(UserEurekapp userEurekapp : usersList){
            if(userEurekapp.getRole().name()=="ORGANIZATION_OWNER"){ orgOwnerUsers++; }
            if(userEurekapp.getRole().name()=="ORGANIZATION_EMPLOYEE"){ orgEmployeesUsers++; }
            if(userEurekapp.getRole().name()=="USER"){ regularUsers++; }
        }


        List<FoundObject> returnedFoundObjectsList = foundObjectRepository.query(null, null, null, null, true);
        List<FoundObject> unreturnedFoundObjectsList = foundObjectRepository.query(null, null, null, null, false);
        Long unreturnedFoundObjects = ((Integer) unreturnedFoundObjectsList.size()).longValue();
        Long returnedFoundObjects = ((Integer) returnedFoundObjectsList.size()).longValue();
        Long foundObjects = unreturnedFoundObjects + returnedFoundObjects;

        return StatsResponseDto.builder()
                .organizations(organizations)
                .users(users)
                .orgOwnerUsers(orgOwnerUsers)
                .orgEmployeeUsers(orgEmployeesUsers)
                .regularUsers(regularUsers)
                .foundObjects(foundObjects)
                .returnedFoundObjects(returnedFoundObjects)
                .build();
    }

}
