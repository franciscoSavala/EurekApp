package com.eurekapp.backend.model;


import com.eurekapp.backend.dto.ReturnedObjectsAchievementDto;

import java.util.ArrayList;
import java.util.List;

public enum ReturnedObjectsAchievement {
    LEVEL1("Primer Acto de Bondad", 1L),
    LEVEL2("Mano Amiga", 5L),
    LEVEL3("Buen Samaritano", 10L),
    LEVEL4("Guardián de la Comunidad", 20L),
    LEVEL5("Héroe Altruista", 50L);

    private final String name;
    private final Long requiredObjects;

    ReturnedObjectsAchievement(String name, Long requiredObjects) {
        this.name = name;
        this.requiredObjects = requiredObjects;
    }

    public String getName() {
        return name;
    }

    public Long getRequiredObjects() {
        return requiredObjects;
    }

    // Método para obtener logros alcanzados
    public static List<ReturnedObjectsAchievementDto> getAchievedLevels(Long objectsReturned) {
        List<ReturnedObjectsAchievementDto> achievements = new ArrayList<>();
        for (ReturnedObjectsAchievement ach : ReturnedObjectsAchievement.values()) {
            if (objectsReturned >= ach.requiredObjects) {
                achievements.add(toDto(ach));
            }
        }
        return achievements;
    }

    // Método para obtener el próximo logro no alcanzado
    public static ReturnedObjectsAchievement getNextAchievement(Long objectsReturned) {
        for (ReturnedObjectsAchievement ach : ReturnedObjectsAchievement.values()) {
            if (objectsReturned < ach.requiredObjects) {
                return ach;
            }
        }
        return null; // Devuelve null si no hay más logros que alcanzar
    }

    public static ReturnedObjectsAchievementDto toDto(ReturnedObjectsAchievement achievement) {
        if (achievement == null) {return null;}
        return ReturnedObjectsAchievementDto.builder()
                .achievementName(achievement.getName())
                .requiredReturnedObjects(achievement.getRequiredObjects())
                .build();
    }
}
