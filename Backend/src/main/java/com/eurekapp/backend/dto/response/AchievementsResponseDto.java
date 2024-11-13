package com.eurekapp.backend.dto.response;

import com.eurekapp.backend.dto.LevelDto;
import com.eurekapp.backend.dto.ReturnedObjectsAchievementDto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Data
@Builder
public class AchievementsResponseDto {

    private Long XP;
    private LevelDto currentLevel;
    private LevelDto nextLevel;
    private Long returnedObjects;
    private List<ReturnedObjectsAchievementDto> returnedObjectsAchievements;
    private ReturnedObjectsAchievementDto nextReturnedObjectsAchievement;
}
