package com.eurekapp.backend.service;

import com.eurekapp.backend.configuration.ScoringProperties;
import com.eurekapp.backend.model.GeoCoordinates;
import com.eurekapp.backend.model.ObjectCategory;

import static com.eurekapp.backend.service.SearchScoringService.SearchMode.TEXT_ONLY;
import static com.eurekapp.backend.service.SearchScoringService.SearchMode.WITH_PHOTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Tests del algoritmo de puntaje compartido: normalización del coseno, el puntaje combinado
 * imagen+texto por categoría (EU-324), la curva geográfica anclada al radio y los umbrales de corte
 * por modo de búsqueda (EU-337). Es la fuente de verdad que usan tanto la búsqueda regular como la inversa. Los pesos α/β
 * y el piso geográfico se leen de {@link ScoringProperties} (aquí, sus valores por defecto).
 */
class SearchScoringServiceTest {

    private static final GeoCoordinates CORDOBA =
            GeoCoordinates.builder().latitude(-31.4201).longitude(-64.1888).build();
    private static final GeoCoordinates BUENOS_AIRES =
            GeoCoordinates.builder().latitude(-34.6037).longitude(-58.3816).build();

    /** Radio de búsqueda con el que se arma el servicio en los tests (el mismo del application.yml). */
    private static final double MAX_RADIUS = 50000.0;

    private ScoringProperties properties;
    private SearchScoringService scoring;

    @BeforeEach
    void setUp() {
        properties = new ScoringProperties();
        scoring = new SearchScoringService(properties, MAX_RADIUS);
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

    // ── EU-337: la curva geográfica está anclada al radio, no a metros ──────────────────────────

    @Test
    void geoModulator_isOneAtTheCenterAndTheFloorAtTheEdgeOfTheRadius() {
        // Mismo punto: la geografía no resta nada.
        assertThat(scoring.geoModulator(CORDOBA, CORDOBA)).isCloseTo(1.0, within(1e-9));
        // Justo en el borde del radio: cae EXACTAMENTE en el piso (es lo que se calibra).
        assertThat(scoring.geoModulator(CORDOBA, northOf(CORDOBA, MAX_RADIUS)))
                .isCloseTo(properties.getGeoFloor(), within(1e-3));
    }

    @Test
    void geoModulator_reScalesItselfWhenTheRadiusChanges() {
        // La misma distancia castiga MÁS con un radio chico: la curva se lee en fracción del radio.
        SearchScoringService narrow = new SearchScoringService(properties, 15000.0);
        GeoCoordinates tenKm = northOf(CORDOBA, 10000.0);
        assertThat(narrow.geoModulator(CORDOBA, tenKm))
                .isLessThan(scoring.geoModulator(CORDOBA, tenKm));
        // Y el borde de ESE radio vuelve a caer en el piso, sin tocar ninguna constante.
        assertThat(narrow.geoModulator(CORDOBA, northOf(CORDOBA, 15000.0)))
                .isCloseTo(properties.getGeoFloor(), within(1e-3));
    }

    @Test
    void geoModulator_beyondTheRadiusStaysAtTheFloor() {
        // Fuera del radio no hay nada que graduar (el radio es un filtro duro aguas arriba).
        assertThat(scoring.geoModulator(CORDOBA, BUENOS_AIRES))
                .isCloseTo(properties.getGeoFloor(), within(1e-9));
    }

    /** Un punto a {@code meters} al norte, para expresar distancias exactas en los tests. */
    private static GeoCoordinates northOf(GeoCoordinates origin, double meters) {
        double degreesPerMeter = 1.0 / (6371000 * Math.PI / 180);
        return GeoCoordinates.builder()
                .latitude(origin.getLatitude() + meters * degreesPerMeter)
                .longitude(origin.getLongitude())
                .build();
    }

    // ── EU-327: umbral calibrado y curva de presentación ────────────────────────────────────────

    @Test
    void isCombinedMatch_cutsAtCalibratedThreshold() {
        double threshold = properties.getMatchThreshold();
        assertThat(scoring.isCombinedMatch(threshold, WITH_PHOTO)).isTrue();          // el borde entra
        assertThat(scoring.isCombinedMatch(threshold + 0.01, WITH_PHOTO)).isTrue();
        assertThat(scoring.isCombinedMatch(threshold - 0.01, WITH_PHOTO)).isFalse();
    }

    @Test
    void displayScore_mapsThresholdToExactlySeventyFivePercent() {
        // El criterio de producto: una coincidencia justo en el umbral se le muestra al usuario como 75%.
        assertThat(scoring.displayScore(properties.getMatchThreshold(), WITH_PHOTO))
                .isCloseTo(SearchScoringService.DISPLAY_THRESHOLD, within(1e-9));
    }

    @Test
    void displayScore_keepsEndpointsAndIsStrictlyIncreasing() {
        // Los extremos quedan fijos: nada de inventar puntaje donde no lo hay, ni superar el 100%.
        assertThat(scoring.displayScore(0.0, WITH_PHOTO)).isEqualTo(0.0);
        assertThat(scoring.displayScore(-0.3, WITH_PHOTO)).isEqualTo(0.0);
        assertThat(scoring.displayScore(1.0, WITH_PHOTO)).isCloseTo(1.0, within(1e-9));

        // Estrictamente creciente => NO altera el ranking; es presentación, no reordenamiento.
        double previous = -1.0;
        for (double raw = 0.05; raw <= 1.0; raw += 0.05) {
            double shown = scoring.displayScore(raw, WITH_PHOTO);
            assertThat(shown).isGreaterThan(previous);
            assertThat(shown).isBetween(0.0, 1.0);
            previous = shown;
        }
    }

    @Test
    void displayScore_showsEveryTrueSeedPairAboveSeventyFivePercent() {
        // Puntajes CRUDOS medidos sobre los 5 pares verdaderos del seed (EU-327). El umbral se calibró
        // como "el peor par (paraguas, 0.5820) menos 0.05", así que los cinco tienen que mostrarse >= 75%.
        double[] trueSeedPairs = {0.5820, 0.7001, 0.7248, 0.7925, 0.8032};
        for (double raw : trueSeedPairs) {
            assertThat(scoring.isCombinedMatch(raw, WITH_PHOTO)).isTrue();
            assertThat(scoring.displayScore(raw, WITH_PHOTO))
                    .isGreaterThanOrEqualTo(SearchScoringService.DISPLAY_THRESHOLD);
        }
    }

    @Test
    void displayScore_followsThresholdWhenRecalibrated() {
        // El exponente se DERIVA del umbral: si mañana se recalibra, el piso mostrado sigue dando 75%
        // solo, sin tener que acordarse de ajustar un segundo número.
        properties.setMatchThreshold(0.40);
        assertThat(scoring.displayScore(0.40, WITH_PHOTO))
                .isCloseTo(SearchScoringService.DISPLAY_THRESHOLD, within(1e-9));

        properties.setMatchThreshold(0.65);
        assertThat(scoring.displayScore(0.65, WITH_PHOTO))
                .isCloseTo(SearchScoringService.DISPLAY_THRESHOLD, within(1e-9));
    }

    @Test
    void displayScore_degenerateThreshold_fallsBackToRawScore() {
        // Umbrales imposibles (0 o 1) no definen una curva: se muestra el crudo, sin romper.
        properties.setMatchThreshold(0.0);
        assertThat(scoring.displayScore(0.6, WITH_PHOTO)).isCloseTo(0.6, within(1e-9));

        properties.setMatchThreshold(1.0);
        assertThat(scoring.displayScore(0.6, WITH_PHOTO)).isCloseTo(0.6, within(1e-9));
    }

    // ── EU-337: cada modo tiene su umbral, y el porcentaje mostrado significa lo mismo ───────────

    @Test
    void thresholds_areSeparatePerMode() {
        assertThat(scoring.matchThreshold(WITH_PHOTO)).isEqualTo(properties.getMatchThreshold());
        assertThat(scoring.matchThreshold(TEXT_ONLY)).isEqualTo(properties.getTextMatchThreshold());
        // El de sólo texto es MÁS BAJO: con una sola señal los puntajes crudos son más chicos.
        assertThat(scoring.matchThreshold(TEXT_ONLY)).isLessThan(scoring.matchThreshold(WITH_PHOTO));
    }

    @Test
    void isCombinedMatch_appliesTheThresholdOfItsOwnMode() {
        double textThreshold = properties.getTextMatchThreshold();
        // Un puntaje que alcanza para una búsqueda sin foto NO alcanza para una con foto: es otra escala.
        assertThat(scoring.isCombinedMatch(textThreshold, TEXT_ONLY)).isTrue();
        assertThat(scoring.isCombinedMatch(textThreshold, WITH_PHOTO)).isFalse();
        assertThat(scoring.isCombinedMatch(textThreshold - 0.01, TEXT_ONLY)).isFalse();
    }

    @Test
    void displayScore_bothModesShowSeventyFivePercentAtTheirOwnThreshold() {
        // El punto de EU-337: el porcentaje significa lo mismo con foto y sin foto, aunque los crudos
        // sean distintos. Un match justo en el corte se muestra 75% en los DOS modos.
        assertThat(scoring.displayScore(properties.getMatchThreshold(), WITH_PHOTO))
                .isCloseTo(SearchScoringService.DISPLAY_THRESHOLD, within(1e-9));
        assertThat(scoring.displayScore(properties.getTextMatchThreshold(), TEXT_ONLY))
                .isCloseTo(SearchScoringService.DISPLAY_THRESHOLD, within(1e-9));
    }

    @Test
    void displayScore_showsEveryTrueSeedPairAboveSeventyFivePercentAlsoWithoutPhoto() {
        // Puntajes crudos SÓLO TEXTO de los 5 pares verdaderos del seed (medidos 2026-08-07).
        double[] textOnlySeedPairs = {0.5468, 0.6803, 0.7478, 0.7678, 0.7277};
        for (double raw : textOnlySeedPairs) {
            assertThat(scoring.isCombinedMatch(raw, TEXT_ONLY)).isTrue();
            assertThat(scoring.displayScore(raw, TEXT_ONLY))
                    .isGreaterThanOrEqualTo(SearchScoringService.DISPLAY_THRESHOLD);
        }
    }

    @Test
    void anExcellentMatchAtTheEdgeOfTheRadiusIsStillShownAboveEightyPercent() {
        // La regla que fija el piso geográfico: la distancia resta, pero nunca tanto como para que una
        // coincidencia excelente desaparezca del radar. El mejor par del seed tiene similitud 0.8032.
        double bestSeedSimilarity = 0.8032;
        double atTheEdge = bestSeedSimilarity * scoring.geoModulator(CORDOBA, northOf(CORDOBA, MAX_RADIUS));
        assertThat(scoring.isCombinedMatch(atTheEdge, WITH_PHOTO)).isTrue();
        assertThat(scoring.displayScore(atTheEdge, WITH_PHOTO)).isGreaterThanOrEqualTo(0.80);
    }
}
