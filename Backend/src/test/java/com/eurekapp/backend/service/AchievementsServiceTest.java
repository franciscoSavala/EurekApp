package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.response.AchievementsResponseDto;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IUserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class AchievementsServiceTest {

    @Mock IUserRepository userRepository;

    @InjectMocks AchievementsService achievementsService;

    private UserEurekapp buildUser(long xp, long returnedObjects) {
        return UserEurekapp.builder()
                .role(Role.USER)
                .username("testuser")
                .password("password")
                .firstName("Test")
                .lastName("User")
                .active(true)
                .XP(xp)
                .returnedObjects(returnedObjects)
                .build();
    }

    @Test
    void getAchievements_userWithZeroXP_returnsLevel1() {
        UserEurekapp user = buildUser(0L, 0L);

        AchievementsResponseDto result = achievementsService.getAchievements(user);

        assertThat(result.getCurrentLevel().getLevelName()).isEqualTo("1");
        assertThat(result.getXP()).isEqualTo(0L);
    }

    @Test
    void getAchievements_userWithXPAtLevel3Threshold_returnsLevel3() {
        UserEurekapp user = buildUser(50L, 0L);

        AchievementsResponseDto result = achievementsService.getAchievements(user);

        assertThat(result.getCurrentLevel().getLevelName()).isEqualTo("3");
        assertThat(result.getNextLevel().getLevelName()).isEqualTo("4");
    }

    @Test
    void getAchievements_userBetweenLevels_returnsCorrectCurrentLevel() {
        // XP=30 is between LEVEL2 (20) and LEVEL3 (50) → current=LEVEL2
        UserEurekapp user = buildUser(30L, 0L);

        AchievementsResponseDto result = achievementsService.getAchievements(user);

        assertThat(result.getCurrentLevel().getLevelName()).isEqualTo("2");
        assertThat(result.getNextLevel().getLevelName()).isEqualTo("3");
    }

    @Test
    void getAchievements_userAtMaxLevel_nextLevelIsNull() {
        UserEurekapp user = buildUser(200L, 0L);

        AchievementsResponseDto result = achievementsService.getAchievements(user);

        assertThat(result.getCurrentLevel().getLevelName()).isEqualTo("5");
        assertThat(result.getNextLevel()).isNull();
    }

    @Test
    void getAchievements_userWithNoReturnedObjects_hasNoAchievements() {
        UserEurekapp user = buildUser(0L, 0L);

        AchievementsResponseDto result = achievementsService.getAchievements(user);

        assertThat(result.getReturnedObjectsAchievements()).isEmpty();
        assertThat(result.getNextReturnedObjectsAchievement().getRequiredReturnedObjects()).isEqualTo(1L);
    }

    @Test
    void getAchievements_userWithSomeReturnedObjects_correctAchievementsUnlocked() {
        // 5 returned objects → unlocks LEVEL1 (1 obj) and LEVEL2 (5 obj)
        UserEurekapp user = buildUser(0L, 5L);

        AchievementsResponseDto result = achievementsService.getAchievements(user);

        assertThat(result.getReturnedObjectsAchievements()).hasSize(2);
        assertThat(result.getNextReturnedObjectsAchievement().getRequiredReturnedObjects()).isEqualTo(10L);
    }

    @Test
    void getAchievements_userWithAllReturnedObjectsAchievements_nextAchievementIsNull() {
        UserEurekapp user = buildUser(0L, 50L);

        AchievementsResponseDto result = achievementsService.getAchievements(user);

        assertThat(result.getReturnedObjectsAchievements()).hasSize(5);
        assertThat(result.getNextReturnedObjectsAchievement()).isNull();
    }
}
