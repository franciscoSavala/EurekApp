package com.eurekapp.backend.service.client;

import com.eurekapp.backend.exception.ApiException;
import io.weaviate.client.WeaviateClient;
import io.weaviate.client.base.Result;
import io.weaviate.client.v1.data.model.WeaviateObject;
import io.weaviate.client.v1.graphql.model.GraphQLError;
import io.weaviate.client.v1.graphql.model.GraphQLResponse;
import org.junit.jupiter.api.Test;
import org.mockito.Answers;

import java.util.List;
import java.util.Map;

import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.within;
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

    // Cuando Weaviate rechaza la consulta, los errores vienen dentro del resultado y no como error de conexión.

    private WeaviateService servicioQueResponde(GraphQLResponse respuesta) {
        WeaviateClient cliente = mock(WeaviateClient.class, Answers.RETURNS_DEEP_STUBS);
        when(cliente.graphQL().raw().withQuery(anyString()).run())
                .thenReturn(new Result<>(200, respuesta, null));
        return new WeaviateService(cliente);
    }

    private GraphQLResponse respuestaRechazada() {
        Map<String, Object> clase = new java.util.HashMap<>();
        clase.put("FoundObject", null);
        Map<String, Object> data = Map.of("Get", clase);
        return GraphQLResponse.builder()
                .data(data)
                .errors(new GraphQLError[]{GraphQLError.builder().message("no such prop").build()})
                .build();
    }

    private GraphQLResponse respuestaConUnObjeto() {
        Map<String, Object> objeto = new java.util.HashMap<>();
        objeto.put("title", "Mochila");
        objeto.put("_additional", new java.util.HashMap<>(Map.of("id", "abc-123", "distance", 0.0)));
        Map<String, Object> data = Map.of("Get", Map.of("FoundObject", List.of(objeto)));
        return GraphQLResponse.builder().data(data).build();
    }

    @Test
    void queryObjects_weaviateRechazaLaConsulta_lanzaApiException() {
        WeaviateService servicio = servicioQueResponde(respuestaRechazada());

        assertThatThrownBy(() -> servicio.queryObjects("FoundObject", null, null, null, List.of("title")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("no such prop");
    }

    @Test
    void hybridQuery_weaviateRechazaLaConsulta_lanzaApiException() {
        WeaviateService servicio = servicioQueResponde(respuestaRechazada());

        assertThatThrownBy(() -> servicio.hybridQuery("FoundObject", "mochila", null, null, null, 0.5,
                null, null, List.of("title"), 10))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("no such prop");
    }

    @Test
    void queryObjects_respuestaValida_devuelveElObjeto() {
        WeaviateService servicio = servicioQueResponde(respuestaConUnObjeto());

        List<WeaviateObject> resultado = servicio.queryObjects("FoundObject", null, null, null, List.of("title"));

        assertThat(resultado).hasSize(1);
        assertThat(resultado.get(0).getId()).isEqualTo("abc-123");
    }

    @Test
    void hybridQuery_respuestaValida_devuelveElObjeto() {
        WeaviateService servicio = servicioQueResponde(respuestaConUnObjeto());

        List<WeaviateObject> resultado = servicio.hybridQuery("FoundObject", "mochila", null, null, null, 0.5,
                null, null, List.of("title"), 10);

        assertThat(resultado).hasSize(1);
        assertThat(resultado.get(0).getId()).isEqualTo("abc-123");
    }
}
