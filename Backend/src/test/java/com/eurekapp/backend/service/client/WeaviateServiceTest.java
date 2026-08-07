package com.eurekapp.backend.service.client;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * EU-320: sobre named vectors, Weaviate 1.24.1 rompe si se pide el campo {@code certainty}, así que
 * la query pide {@code distance} y se reconstruye la certeza coseno con {@code certainty = 1 - distance/2}.
 * Estos tests fijan esa conversión (la MISMA que usa Weaviate para coseno) contra los tres puntos de
 * referencia verificados empíricamente contra el motor real: idéntico → 1, ortogonal → 0.5, opuesto → 0.
 */
class WeaviateServiceTest {

    @Test
    void cosineCertaintyFromDistance_identicalVectors_certaintyOne() {
        assertThat(WeaviateService.cosineCertaintyFromDistance(0.0)).isCloseTo(1.0, within(1e-9));
    }

    @Test
    void cosineCertaintyFromDistance_orthogonalVectors_certaintyHalf() {
        assertThat(WeaviateService.cosineCertaintyFromDistance(1.0)).isCloseTo(0.5, within(1e-9));
    }

    @Test
    void cosineCertaintyFromDistance_oppositeVectors_certaintyZero() {
        assertThat(WeaviateService.cosineCertaintyFromDistance(2.0)).isCloseTo(0.0, within(1e-9));
    }

    @Test
    void cosineCertaintyFromDistance_isMonotonicallyDecreasing() {
        // A menor distancia, mayor certeza (mismo orden que usa el ranking del scoring).
        assertThat(WeaviateService.cosineCertaintyFromDistance(0.226))
                .isGreaterThan(WeaviateService.cosineCertaintyFromDistance(0.251));
    }
}
