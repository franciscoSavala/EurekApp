package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.response.StatsResponseDto;
import com.eurekapp.backend.model.Role;
import lombok.AllArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@AllArgsConstructor
@Service
public class StatsService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);
    private PlatformCountsService platformCountsService;

    /*
    *  Método usado para obtener las estadísticas de la aplicación.
    * */
    public StatsResponseDto getStats(){

        Long organizations = platformCountsService.countOrganizations();
        Long users = platformCountsService.countUsers();
        Long orgOwnerUsers = platformCountsService.countUsers(Role.ORGANIZATION_OWNER);
        Long orgEmployeesUsers = platformCountsService.countUsers(Role.ORGANIZATION_EMPLOYEE);
        Long regularUsers = platformCountsService.countUsers(Role.USER);

        Long unreturnedFoundObjects = platformCountsService.countUnreturnedFoundObjects();
        Long returnedFoundObjects = platformCountsService.countReturnedFoundObjects();
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
