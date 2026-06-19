package com.eurekapp.backend.service;

import com.eurekapp.backend.model.GeoCoordinates;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Tests del algoritmo de puntaje compartido (EU-279): normalización del coseno, combinación
 * MOORA texto/geografía (95/5) y umbral de corte. Es la fuente de verdad que usan tanto la
 * búsqueda regular como la inversa.
 */
class SearchScoringServiceTest {

    private static final GeoCoordinates CORDOBA =
            GeoCoordinates.builder().latitude(-31.4201).longitude(-64.1888).build();
    private static final GeoCoordinates BUENOS_AIRES =
            GeoCoordinates.builder().latitude(-34.6037).longitude(-58.3816).build();

    private SearchScoringService scoring;

    @BeforeEach
    void setUp() {
        scoring = new SearchScoringService();
    }

    @Test
    void normalizeCosineScore_mapsRange() {
        assertThat(scoring.normalizeCosineScore(null)).isEqualTo(0.0);
        assertThat(scoring.normalizeCosineScore(0.5f)).isEqualTo(0.0);
        assertThat(scoring.normalizeCosineScore(0.4f)).isEqualTo(0.0);
        assertThat(scoring.normalizeCosineScore(0.75f)).isCloseTo(0.5, within(1e-6));
        assertThat(scoring.normalizeCosineScore(1.0f)).isCloseTo(1.0, within(1e-6));
    }

    @Test
    void totalScore_withoutCertainty_isPurelyGeographic() {
        // Sin certeza coseno el puntaje es 100% geográfico (mismas coordenadas => geoScore 1.0).
        assertThat(scoring.totalScore(null, CORDOBA, CORDOBA)).isCloseTo(1.0, within(1e-6));
    }

    @Test
    void totalScore_combinesTextAndGeo() {
        // Coseno perfecto + misma ubicación => 0.95*1 + 0.05*1 = 1.0.
        assertThat(scoring.totalScore(1.0f, CORDOBA, CORDOBA)).isCloseTo(1.0, within(1e-6));
    }

    @Test
    void totalScore_distantLocation_lowersScoreButTextDominates() {
        double sameLocation = scoring.totalScore(1.0f, CORDOBA, CORDOBA);
        double farLocation = scoring.totalScore(1.0f, CORDOBA, BUENOS_AIRES);
        // La distancia baja el puntaje (el 5% geográfico), pero el texto (95%) sigue mandando.
        assertThat(farLocation).isLessThan(sameLocation);
        assertThat(farLocation).isGreaterThanOrEqualTo(0.95);
    }

    @Test
    void isMatch_appliesThreshold() {
        assertThat(scoring.isMatch(SearchScoringService.MIN_SCORE)).isTrue();
        assertThat(scoring.isMatch(0.9)).isTrue();
        assertThat(scoring.isMatch(0.7499)).isFalse();
        assertThat(scoring.isMatch(0.0)).isFalse();
    }
}
