package com.eurekapp.backend.service.client;

import io.weaviate.client.WeaviateClient;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

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

    // Sin UUID validos que pedir (vacio, nulos, o textos que no son UUID y por lo tanto no pueden existir)
    // no se consulta a Weaviate.
    @Test
    void getObjectsByUuids_sinUuidsValidos_noConsultaWeaviate() {
        WeaviateClient client = mock(WeaviateClient.class);
        WeaviateService service = new WeaviateService(client);

        assertThat(service.getObjectsByUuids("FoundObject", List.of(), List.of("title"))).isEmpty();
        assertThat(service.getObjectsByUuids("FoundObject", null, List.of("title"))).isEmpty();
        assertThat(service.getObjectsByUuids("FoundObject", Arrays.asList(null, "no-es-un-uuid", "\" } }"),
                List.of("title"))).isEmpty();

        verifyNoInteractions(client);
    }
}
