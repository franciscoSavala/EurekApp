package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.FoundObject;
import com.eurekapp.backend.model.GeoCoordinates;
import com.eurekapp.backend.service.client.WeaviateService;
import io.weaviate.client.v1.data.model.WeaviateObject;
import io.weaviate.client.v1.filters.WhereFilter;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests del rework de búsqueda (EU-323): el repositorio persiste el objeto encontrado con DOS
 * vectores nombrados (image/text) en vez del vector único anterior, ya no guarda la descripción
 * generada por IA, y sigue llevando la categoría dura. La búsqueda vectorial apunta al vector "text".
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FoundObjectRepositoryTest {

    @Mock WeaviateService weaviateService;
    @Mock IUserRepository userRepository;

    @Captor ArgumentCaptor<WeaviateObject> objectCaptor;

    private FoundObjectRepository repository() {
        return new FoundObjectRepository(weaviateService, userRepository, 50000.0);
    }

    private static FoundObject.FoundObjectBuilder baseObject() {
        return FoundObject.builder()
                .uuid("fo-1")
                .title("Billetera de cuero")
                .humanDescription("negra, con tarjetas")
                .organizationId("1")
                .foundDate(LocalDateTime.now())
                .coordinates(GeoCoordinates.builder().latitude(-31.4).longitude(-64.1).build())
                .wasReturned(false)
                .category("BILLETERA");
    }

    @Test
    void add_persistsBothNamedVectors_andCategory_withoutAiDescription() {
        FoundObject fo = baseObject()
                .imageEmbedding(List.of(0.1f, 0.2f))
                .textEmbedding(List.of(0.3f, 0.4f, 0.5f))
                .build();

        repository().add(fo);

        verify(weaviateService).createObject(objectCaptor.capture());
        WeaviateObject stored = objectCaptor.getValue();

        assertThat(stored.getVectors()).containsOnlyKeys("image", "text");
        assertThat(stored.getVectors().get("image")).containsExactly(0.1f, 0.2f);
        assertThat(stored.getVectors().get("text")).containsExactly(0.3f, 0.4f, 0.5f);
        assertThat(stored.getProperties()).containsEntry("category", "BILLETERA");
        // La descripción por IA se eliminó del modelo/esquema (EU-323, decisión 2).
        assertThat(stored.getProperties()).doesNotContainKey("ai_description");
    }

    @Test
    void add_withoutImageVector_persistsOnlyTextVector() {
        FoundObject fo = baseObject()
                .textEmbedding(List.of(0.3f, 0.4f))
                .build();

        repository().add(fo);

        verify(weaviateService).createObject(objectCaptor.capture());
        assertThat(objectCaptor.getValue().getVectors()).containsOnlyKeys("text");
    }

    @Test
    void query_searchesAgainstTextVector_andMapsCategoryAndCertaintyBack() {
        WeaviateObject result = WeaviateObject.builder()
                .id("fo-1")
                .properties(new HashMap<>(Map.of(
                        "title", "Billetera",
                        "category", "BILLETERA",
                        "found_date", "2026-07-05T10:00:00Z")))
                .additional(Map.of("certainty", 0.9d))
                .build();
        when(weaviateService.queryObjects(anyString(), any(), anyString(), any(), any(), any(), any()))
                .thenReturn(List.of(result));

        List<FoundObject> found = repository()
                .query(List.of(0.1f, 0.2f), "1", null, null, null, false, "BILLETERA");

        assertThat(found).hasSize(1);
        assertThat(found.get(0).getCategory()).isEqualTo("BILLETERA");
        assertThat(found.get(0).getScore()).isEqualTo(0.9f);
        // La búsqueda vectorial (texto) apunta al vector nombrado "text".
        verify(weaviateService).queryObjects(eq("FoundObject"), any(), eq("text"), any(), any(), any(), any());
    }

    private static WeaviateObject candidate(String uuid, double certainty) {
        return WeaviateObject.builder()
                .id(uuid)
                .properties(new HashMap<>(Map.of(
                        "title", "Billetera",
                        "category", "BILLETERA",
                        "found_date", "2026-07-05T10:00:00Z")))
                .additional(Map.of("certainty", certainty))
                .build();
    }

    @Test
    void queryDual_mergesByUuid_exposingBothCertainties() {
        // fo-1 aparece por ambas modalidades; fo-2 sólo por imagen; fo-3 sólo por texto.
        when(weaviateService.queryObjects(eq("FoundObject"), any(), eq("image"), any(), any(), any(), any()))
                .thenReturn(List.of(candidate("fo-1", 0.9d), candidate("fo-2", 0.8d)));
        when(weaviateService.queryObjects(eq("FoundObject"), any(), eq("text"), any(), any(), any(), any()))
                .thenReturn(List.of(candidate("fo-1", 0.7d), candidate("fo-3", 0.6d)));

        List<FoundObject> found = repository().queryDual(
                List.of(0.1f, 0.2f), List.of(0.3f, 0.4f), "1", null, null, null, false, "BILLETERA", null, null);

        assertThat(found).extracting(FoundObject::getUuid).containsExactly("fo-1", "fo-2", "fo-3");
        // El puntaje final lo calcula el scoring aguas arriba (EU-324-D); acá queda sin fijar.
        assertThat(found).extracting(FoundObject::getScore).containsOnlyNulls();

        FoundObject both = found.get(0);
        assertThat(both.getImageCertainty()).isEqualTo(0.9f);
        assertThat(both.getTextCertainty()).isEqualTo(0.7f);

        FoundObject onlyImage = found.get(1);
        assertThat(onlyImage.getImageCertainty()).isEqualTo(0.8f);
        assertThat(onlyImage.getTextCertainty()).isNull();

        FoundObject onlyText = found.get(2);
        assertThat(onlyText.getImageCertainty()).isNull();
        assertThat(onlyText.getTextCertainty()).isEqualTo(0.6f);
    }

    @Test
    void queryDual_withoutImageVector_queriesOnlyText() {
        when(weaviateService.queryObjects(eq("FoundObject"), any(), eq("text"), any(), any(), any(), any()))
                .thenReturn(List.of(candidate("fo-1", 0.7d)));

        List<FoundObject> found = repository().queryDual(
                null, List.of(0.3f, 0.4f), "1", null, null, null, false, "BILLETERA", null, null);

        assertThat(found).hasSize(1);
        assertThat(found.get(0).getImageCertainty()).isNull();
        assertThat(found.get(0).getTextCertainty()).isEqualTo(0.7f);
        // No debe consultarse el vector de imagen si no se recibió.
        verify(weaviateService, never()).queryObjects(eq("FoundObject"), any(), eq("image"), any(), any(), any(), any());
    }

    /** Busca (recursivamente) un operando WithinGeoRange dentro de un WhereFilter, sea hoja o compuesto. */
    private static boolean hasGeoRangeFilter(WhereFilter filter) {
        if (filter == null) return false;
        if (filter.getValueGeoRange() != null) return true;
        if (filter.getOperands() != null) {
            for (WhereFilter op : filter.getOperands()) {
                if (hasGeoRangeFilter(op)) return true;
            }
        }
        return false;
    }

    @Test
    void queryDual_withCoordinates_appliesNativeGeoRadiusFilter() {
        // EU-320: el radio vuelve a ser filtro DURO nativo en Weaviate (antes estaba deshabilitado).
        when(weaviateService.queryObjects(eq("FoundObject"), any(), anyString(), any(), any(), any(), any()))
                .thenReturn(List.of());

        GeoCoordinates coords = GeoCoordinates.builder().latitude(-31.4377).longitude(-64.1829).build();
        repository().queryDual(List.of(0.1f, 0.2f), List.of(0.3f, 0.4f), "1", coords,
                null, null, false, "BILLETERA", null, null);

        ArgumentCaptor<WhereFilter> filterCaptor = ArgumentCaptor.forClass(WhereFilter.class);
        verify(weaviateService).queryObjects(eq("FoundObject"), any(), eq("image"),
                filterCaptor.capture(), any(), any(), any());
        assertThat(hasGeoRangeFilter(filterCaptor.getValue()))
                .as("la query debe incluir el filtro WithinGeoRange cuando hay coordenadas").isTrue();
    }

    @Test
    void queryDual_withoutCoordinates_omitsGeoRadiusFilter() {
        when(weaviateService.queryObjects(eq("FoundObject"), any(), anyString(), any(), any(), any(), any()))
                .thenReturn(List.of());

        repository().queryDual(List.of(0.1f, 0.2f), List.of(0.3f, 0.4f), "1", null,
                null, null, false, "BILLETERA", null, null);

        ArgumentCaptor<WhereFilter> filterCaptor = ArgumentCaptor.forClass(WhereFilter.class);
        verify(weaviateService).queryObjects(eq("FoundObject"), any(), eq("image"),
                filterCaptor.capture(), any(), any(), any());
        assertThat(hasGeoRangeFilter(filterCaptor.getValue()))
                .as("sin coordenadas no debe haber filtro geográfico").isFalse();
    }

    @Test
    void namedVectors_omitsNullAndEmptyEntries() {
        assertThat(FoundObjectRepository.namedVectors(null, List.of(1f))).containsOnlyKeys("text");
        assertThat(FoundObjectRepository.namedVectors(List.of(), List.of(1f))).containsOnlyKeys("text");
        assertThat(FoundObjectRepository.namedVectors(List.of(1f), null)).containsOnlyKeys("image");
        assertThat(FoundObjectRepository.namedVectors(null, null)).isEmpty();
    }

    private static WeaviateObject weaviateObject(String id, String title, Object coordinates) {
        Map<String, Object> props = new HashMap<>();
        props.put("title", title);
        props.put("human_description", "descripcion de " + title);
        props.put("object_finder_user_id", "0");
        props.put("coordinates", coordinates);
        return WeaviateObject.builder().id(id).properties(props).build();
    }

    private static final String UUID_A = "11111111-1111-1111-1111-111111111111";
    private static final String UUID_B = "22222222-2222-2222-2222-222222222222";

    // Varios objetos se piden juntos: el repositorio los devuelve por el UUID con el que se pidieron, y
    // el que no existe simplemente no figura.
    @Test
    void getByUuids_devuelveLosQueExistenPorSuUuidYPidePropiedadesQueConvierte() {
        when(weaviateService.getObjectsByUuids(eq("FoundObject"), any(), any()))
                .thenReturn(List.of(weaviateObject(UUID_A, "Billetera", null)));

        Map<String, FoundObject> result = repository().getByUuids(List.of(UUID_A, "no-existe"));

        assertThat(result).containsOnlyKeys(UUID_A);
        assertThat(result.get(UUID_A).getTitle()).isEqualTo("Billetera");
        ArgumentCaptor<List<String>> fields = ArgumentCaptor.forClass(List.class);
        verify(weaviateService).getObjectsByUuids(eq("FoundObject"), any(), fields.capture());
        assertThat(fields.getValue()).containsExactlyInAnyOrder("title", "object_finder_user_id",
                "human_description", "found_date", "was_returned", "coordinates", "organization_id", "category");
    }

    // Weaviate devuelve el id en minusculas: el objeto igual se encuentra con el UUID tal como se guardo.
    @Test
    void getByUuids_encuentraElObjetoAunqueElUuidGuardadoTengaMayusculas() {
        String enMayusculas = UUID_A.replace('1', 'A').toUpperCase();
        when(weaviateService.getObjectsByUuids(eq("FoundObject"), any(), any()))
                .thenReturn(List.of(weaviateObject(enMayusculas.toLowerCase(), "Billetera", null)));

        Map<String, FoundObject> result = repository().getByUuids(List.of(enMayusculas));

        assertThat(result).containsOnlyKeys(enMayusculas);
    }

    // Sin UUID que pedir (vacio, solo nulos o nulo) no se consulta a Weaviate.
    @Test
    void getByUuids_sinUuids_noConsultaWeaviate() {
        assertThat(repository().getByUuids(List.of())).isEmpty();
        assertThat(repository().getByUuids(java.util.Arrays.asList(null, null))).isEmpty();
        assertThat(repository().getByUuids(null)).isEmpty();

        verify(weaviateService, never()).getObjectsByUuids(anyString(), any(), any());
    }

    // Un objeto con datos rotos no estropea a los demas: solo el no figura, y los otros salen completos.
    @Test
    void getByUuids_unObjetoConDatosRotos_dejaSinDatosSoloAEseObjeto() {
        when(weaviateService.getObjectsByUuids(eq("FoundObject"), any(), any())).thenReturn(List.of(
                weaviateObject(UUID_A, "Billetera", null),
                weaviateObject(UUID_B, "Roto", "coordenadas que no son un mapa")));

        Map<String, FoundObject> result = repository().getByUuids(List.of(UUID_A, UUID_B));

        assertThat(result).containsOnlyKeys(UUID_A);
    }

    // En la variante estricta (exportacion), el objeto con datos rotos hace fallar la llamada, como antes.
    @Test
    void getByUuidsOrFail_unObjetoConDatosRotos_lanzaLaExcepcion() {
        when(weaviateService.getObjectsByUuids(eq("FoundObject"), any(), any())).thenReturn(List.of(
                weaviateObject(UUID_B, "Roto", "coordenadas que no son un mapa")));

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> repository().getByUuidsOrFail(List.of(UUID_B)))
                .isInstanceOf(RuntimeException.class);
    }
}
