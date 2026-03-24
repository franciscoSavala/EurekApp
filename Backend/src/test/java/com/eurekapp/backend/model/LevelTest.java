package com.eurekapp.backend.model;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LevelTest {

    // --- getLevel ---

    @Test
    void getLevel_xpAtZero_returnsLevel1() {
        assertThat(Level.getLevel(0L).getName()).isEqualTo("1");
    }

    @Test
    void getLevel_xpExactlyAtLevel2Threshold_returnsLevel2() {
        assertThat(Level.getLevel(20L).getName()).isEqualTo("2");
    }

    @Test
    void getLevel_xpBetweenLevel2AndLevel3_returnsLevel2() {
        assertThat(Level.getLevel(30L).getName()).isEqualTo("2");
    }

    @Test
    void getLevel_xpExactlyAtLevel3Threshold_returnsLevel3() {
        assertThat(Level.getLevel(50L).getName()).isEqualTo("3");
    }

    @Test
    void getLevel_xpExactlyAtLevel4Threshold_returnsLevel4() {
        assertThat(Level.getLevel(100L).getName()).isEqualTo("4");
    }

    @Test
    void getLevel_xpExactlyAtMaxLevel_returnsLevel5() {
        assertThat(Level.getLevel(200L).getName()).isEqualTo("5");
    }

    @Test
    void getLevel_xpAboveMaxThreshold_returnsLevel5() {
        assertThat(Level.getLevel(999L).getName()).isEqualTo("5");
    }

    // --- getNextLevel ---

    @Test
    void getNextLevel_xpAtZero_returnsLevel2() {
        // At XP=0 the user is on LEVEL1 (requiredXP=0), next is LEVEL2 (requiredXP=20)
        assertThat(Level.getNextLevel(0L).getName()).isEqualTo("2");
    }

    @Test
    void getNextLevel_xpJustBelowLevel3_returnsLevel3() {
        assertThat(Level.getNextLevel(49L).getName()).isEqualTo("3");
    }

    @Test
    void getNextLevel_xpAtMaxLevel_returnsNull() {
        assertThat(Level.getNextLevel(200L)).isNull();
    }

    @Test
    void getNextLevel_xpAboveMaxLevel_returnsNull() {
        assertThat(Level.getNextLevel(999L)).isNull();
    }
}
