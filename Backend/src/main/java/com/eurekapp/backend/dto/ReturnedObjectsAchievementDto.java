package com.eurekapp.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@NoArgsConstructor
@AllArgsConstructor
@Data
@Builder
public class ReturnedObjectsAchievementDto {
    String achievementName;
    Long requiredReturnedObjects;
}
