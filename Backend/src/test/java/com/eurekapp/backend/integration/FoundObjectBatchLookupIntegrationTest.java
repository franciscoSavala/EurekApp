package com.eurekapp.backend.integration;

import com.eurekapp.backend.BackendApplication;
import com.eurekapp.backend.model.FoundObject;
import com.eurekapp.backend.model.GeoCoordinates;
import com.eurekapp.backend.repository.FoundObjectRepository;
import io.weaviate.client.WeaviateClient;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Comprueba contra el Weaviate real (WEAVIATE_URL) que traer los objetos de un listado juntos devuelve
 * TODOS, también cuando son más que los 25 que Weaviate devuelve si no se le pone límite y más que
 * los de una tanda. Crea sus propios objetos y los borra uno por uno por id: nunca se vacía la clase
 * entera, porque eso hace caer a Weaviate 1.24.1.
 */
@SpringBootTest(classes = BackendApplication.class)
class FoundObjectBatchLookupIntegrationTest {

    // Más que una tanda de consulta (100) y que el límite por defecto de Weaviate (25).
    private static final int CANTIDAD = 130;

    @Autowired FoundObjectRepository foundObjectRepository;
    @Autowired @Qualifier("weaviateClient") WeaviateClient weaviateClient;

    private final List<String> creados = new ArrayList<>();

    @AfterEach
    void borrarLosObjetosCreados() {
        for (String uuid : creados) {
            weaviateClient.data().deleter().withClassName("FoundObject").withID(uuid).run();
        }
        creados.clear();
    }

    private void crear(String uuid, String titulo) {
        foundObjectRepository.add(FoundObject.builder()
                .uuid(uuid)
                .title(titulo)
                .humanDescription("descripcion de " + titulo)
                .organizationId("prueba-consulta-por-tandas")
                .foundDate(LocalDateTime.of(2026, 9, 1, 10, 0))
                .coordinates(GeoCoordinates.builder().latitude(-31.4).longitude(-64.1).build())
                .wasReturned(false)
                .category("OTROS")
                .build());
        creados.add(uuid);
    }

    @Test
    void getByUuids_traeTodosLosObjetosPedidos_aunqueSeanMasQueElLimitePorDefectoYQueUnaTanda() {
        for (int i = 0; i < CANTIDAD; i++) {
            crear(UUID.randomUUID().toString(), "Objeto " + i);
        }
        String inexistente = UUID.randomUUID().toString();
        List<String> pedidos = new ArrayList<>(creados);
        pedidos.add(inexistente);
        pedidos.add(creados.get(0)); // repetido
        pedidos.add(null);

        Map<String, FoundObject> resultado = foundObjectRepository.getByUuids(pedidos);

        assertThat(resultado).hasSize(CANTIDAD);
        assertThat(resultado).doesNotContainKey(inexistente);
        for (int i = 0; i < CANTIDAD; i++) {
            FoundObject fo = resultado.get(creados.get(i));
            assertThat(fo).as("objeto %d", i).isNotNull();
            assertThat(fo.getUuid()).isEqualTo(creados.get(i));
            assertThat(fo.getTitle()).isEqualTo("Objeto " + i);
            assertThat(fo.getHumanDescription()).isEqualTo("descripcion de Objeto " + i);
            assertThat(fo.getOrganizationId()).isEqualTo("prueba-consulta-por-tandas");
            assertThat(fo.getWasReturned()).isFalse();
            assertThat(fo.getCategory()).isEqualTo("OTROS");
            assertThat(fo.getFoundDate()).isEqualTo(LocalDateTime.of(2026, 9, 1, 10, 0));
            assertThat(fo.getCoordinates().getLatitude()).isEqualTo(-31.4);
        }
    }

    @Test
    void getByUuids_conUnSoloUuid_traeEseObjeto() {
        String uuid = UUID.randomUUID().toString();
        crear(uuid, "Unico");

        Map<String, FoundObject> resultado = foundObjectRepository.getByUuids(List.of(uuid));

        assertThat(resultado).containsOnlyKeys(uuid);
        assertThat(resultado.get(uuid).getTitle()).isEqualTo("Unico");
    }

    @Test
    void getByUuids_conUuidsQueNoExisten_devuelveVacio() {
        Map<String, FoundObject> resultado = foundObjectRepository.getByUuids(
                List.of(UUID.randomUUID().toString(), UUID.randomUUID().toString()));

        assertThat(resultado).isEmpty();
    }
}
