package com.eurekapp.backend.model;

import com.eurekapp.backend.dto.LevelDto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

public enum Level {
    LEVEL1("1", 0L),
    LEVEL2("2", 20L),
    LEVEL3("3", 50L),
    LEVEL4("4", 100L),
    LEVEL5("5", 200L);

    private final String name;
    private final Long requiredXP;

    Level(String name, Long requiredXP) {
        this.name = name;
        this.requiredXP = requiredXP;
    }

    public String getName() {
        return name;
    }

    public Long requiredXP() {
        return requiredXP;
    }

    // Método para obtener el nivel alcanzado
    public static Level getLevel(Long XP) {
        Level highestLevel = null;
        for (Level level : Level.values()) {
            if (XP >= level.requiredXP()) {
                highestLevel = level;
            } else {
                break; // Deja de buscar al encontrar un nivel que no cumple
            }
        }
        return highestLevel;
    }

    // Método para obtener el próximo nivel no alcanzado
    public static Level getNextLevel(Long XP) {
        for (Level level : Level.values()) {
            if (XP < level.requiredXP) {
                return level;
            }
        }
        return null; // Devuelve null si no hay más niveles que alcanzar
    }

   public static LevelDto toDto(Level level) {
        if (level == null) {return null;}
        return LevelDto.builder()
                .levelName(level.getName())
                .requiredXP(level.requiredXP())
                .build();
    }

}
