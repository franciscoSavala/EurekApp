package com.eurekapp.backend.service;

import com.eurekapp.backend.configuration.ScoringProperties;
import com.eurekapp.backend.model.GeoCoordinates;
import com.eurekapp.backend.model.ObjectCategory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Tests del algoritmo de puntaje compartido: normalización del coseno, combinación MOORA legacy
 * (texto/geografía 95/5), el puntaje combinado imagen+texto por categoría (EU-324) y el umbral de
 * corte. Es la fuente de verdad que usan tanto la búsqueda regular como la inversa. Los pesos α/β
 * y el piso geográfico se leen de {@link ScoringProperties} (aquí, sus valores por defecto).
 */
class SearchScoringServiceTest {

    private static final GeoCoordinates CORDOBA =
            GeoCoordinates.builder().latitude(-31.4201).longitude(-64.1888).build();
    private static final GeoCoordinates BUENOS_AIRES =
            GeoCoordinates.builder().latitude(-34.6037).longitude(-58.3816).build();

    private ScoringProperties properties;
    private SearchScoringService scoring;

    @BeforeEach
    void setUp() {
        properties = new ScoringProperties();
        scoring = new SearchScoringService(properties);
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

    // ── EU-324: puntaje combinado imagen + texto por categoría ──────────────────────────────────

    @Test
    void geoModulator_sameLocation_doesNotPenalize() {
        // Mismo lugar => modulador máximo (1.0): la geografía no descuenta nada.
        assertThat(scoring.geoModulator(CORDOBA, CORDOBA)).isCloseTo(1.0, within(1e-6));
    }

    @Test
    void geoModulator_missingCoords_defensiveFallback() {
        // Red de seguridad: la ubicación es OBLIGATORIA en la búsqueda (se valida aguas arriba), así
        // que este caso no debería darse; si igual faltara, no se modula en vez de romper el ranking.
        assertThat(scoring.geoModulator(null, CORDOBA)).isEqualTo(1.0);
        assertThat(scoring.geoModulator(CORDOBA, null)).isEqualTo(1.0);
    }

    @Test
    void geoModulator_farLocation_floorsAtGeoFloor_neverZero() {
        // A gran distancia el modulador baja pero nunca por debajo del piso (la geografía atenúa, no anula).
        double far = scoring.geoModulator(CORDOBA, BUENOS_AIRES);
        assertThat(far).isGreaterThanOrEqualTo(properties.getGeoFloor());
        assertThat(far).isCloseTo(properties.getGeoFloor(), within(1e-3));
    }

    @Test
    void combinedScore_bothPerfect_sameLocation_isOne() {
        // Imagen y texto perfectos + misma ubicación => 0.5*1 + 0.5*1, modulado por 1.0 => 1.0.
        assertThat(scoring.combinedScore(1.0f, 1.0f, ObjectCategory.OTROS, CORDOBA, CORDOBA))
                .isCloseTo(1.0, within(1e-6));
    }

    @Test
    void combinedScore_wallet_textDominatesWeighting() {
        // BILLETERA: imagen floja (0.75 => norm 0.5), texto perfecto (1.0 => norm 1.0).
        // 0.35*0.5 + 0.65*1.0 = 0.825. El texto pesa más, como manda el dominio.
        assertThat(scoring.combinedScore(0.75f, 1.0f, ObjectCategory.BILLETERA, CORDOBA, CORDOBA))
                .isCloseTo(0.825, within(1e-6));
    }

    @Test
    void combinedScore_clothing_imageDominatesOverWallet() {
        // Con imagen fuerte y texto nulo, ROPA (imagen pesa) puntúa mucho más que BILLETERA (texto pesa).
        double ropa = scoring.combinedScore(1.0f, 0.5f, ObjectCategory.ROPA, CORDOBA, CORDOBA);
        double billetera = scoring.combinedScore(1.0f, 0.5f, ObjectCategory.BILLETERA, CORDOBA, CORDOBA);
        assertThat(ropa).isCloseTo(0.85, within(1e-6));     // 0.85*1.0 + 0.15*0.0
        assertThat(billetera).isCloseTo(0.35, within(1e-6)); // 0.35*1.0 + 0.65*0.0
        assertThat(ropa).isGreaterThan(billetera);
    }

    @Test
    void combinedScore_singleModality_renormalizesAndIsNotPenalized() {
        // Sólo texto presente (sin foto): el peso de la imagen se redistribuye al texto => un match
        // textual perfecto vale 1.0, no queda reducido por el peso de la modalidad ausente.
        assertThat(scoring.combinedScore(null, 1.0f, ObjectCategory.OTROS, CORDOBA, CORDOBA))
                .isCloseTo(1.0, within(1e-6));
        // Sólo imagen presente en BILLETERA (donde la imagen pesa poco): igual vale 1.0, no 0.35.
        assertThat(scoring.combinedScore(1.0f, null, ObjectCategory.BILLETERA, CORDOBA, CORDOBA))
                .isCloseTo(1.0, within(1e-6));
    }

    @Test
    void combinedScore_noSimilarity_isZero() {
        // Sin ninguna certeza no hay evidencia de parecido => 0, aunque la ubicación coincida.
        assertThat(scoring.combinedScore(null, null, ObjectCategory.OTROS, CORDOBA, CORDOBA))
                .isEqualTo(0.0);
    }

    @Test
    void combinedScore_nullCategory_usesFiftyFifty() {
        // Categoría nula => pesos por defecto 50/50 (no rompe).
        // imagen 1.0 (norm 1.0), texto 0.75 (norm 0.5) => 0.5*1.0 + 0.5*0.5 = 0.75.
        assertThat(scoring.combinedScore(1.0f, 0.75f, null, CORDOBA, CORDOBA))
                .isCloseTo(0.75, within(1e-6));
    }

    @Test
    void combinedScore_farLocation_modulatesButDoesNotAnnul() {
        // Match perfecto pero lejano: el modulador geográfico lo baja hasta ~GEO_FLOOR, no a 0.
        double far = scoring.combinedScore(1.0f, 1.0f, ObjectCategory.OTROS, CORDOBA, BUENOS_AIRES);
        assertThat(far).isCloseTo(properties.getGeoFloor(), within(1e-3));
        assertThat(far).isGreaterThanOrEqualTo(properties.getGeoFloor());
    }
}
