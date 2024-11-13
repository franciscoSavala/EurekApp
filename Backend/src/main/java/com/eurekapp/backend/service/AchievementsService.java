package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.*;
import com.eurekapp.backend.dto.response.AchievementsResponseDto;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.repository.IUserRepository;
import lombok.AllArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

@AllArgsConstructor
@Service
public class AchievementsService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);
    private IUserRepository userRepository;

    public AchievementsResponseDto getAchievements(UserEurekapp user) {

        // Obtenemos el nivel actual del usuario.
        Level currentLevel = Level.getLevel(user.getXP());

        // Obtenemos el siguiente nivel
        Level nextLevel = Level.getNextLevel(user.getXP());

        // Obtenemos las insignias ya obtenidas por el usuario por haber devuelto objetos ajenos
        List<ReturnedObjectsAchievementDto> roa = ReturnedObjectsAchievement.getAchievedLevels(user.getReturnedObjects());

        // Obtenemos la siguiente insignia por devolve objetos a ser alcanzada
        ReturnedObjectsAchievementDto roaDto = ReturnedObjectsAchievement.toDto(
                ReturnedObjectsAchievement.getNextAchievement(user.getReturnedObjects()));

        return AchievementsResponseDto.builder()
                .XP(user.getXP())
                .currentLevel(Level.toDto(currentLevel))
                .nextLevel(Level.toDto(nextLevel))
                .returnedObjects(user.getReturnedObjects())
                .returnedObjectsAchievements(roa)
                .nextReturnedObjectsAchievement(roaDto)
                .build();
    }
}