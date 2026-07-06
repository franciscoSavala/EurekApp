package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.GeoCoordinates;
import com.eurekapp.backend.model.LostObject;
import com.eurekapp.backend.service.client.WeaviateService;
import io.weaviate.client.v1.data.model.WeaviateObject;
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
 * Tests del rework de búsqueda (EU-323): la búsqueda guardada (LostObject) también se persiste con
 * DOS vectores nombrados (image/text) y ahora lleva su propia categoría dura. La búsqueda inversa
 * (found→lost) apunta al vector nombrado "text".
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LostObjectRepositoryTest {

    @Mock WeaviateService weaviateService;
    @Mock IOrganizationRepository organizationRepository;

    @Captor ArgumentCaptor<WeaviateObject> objectCaptor;

    private LostObjectRepository repository() {
        return new LostObjectRepository(weaviateService, organizationRepository);
    }

    @Test
    void add_persistsTextVector_andCategoryProperty() {
        LostObject lo = LostObject.builder()
                .uuid("lo-1")
                .username("user@test.com")
                .description("billetera negra de cuero")
                .lostDate(LocalDateTime.now())
                .coordinates(GeoCoordinates.builder().latitude(-31.4).longitude(-64.1).build())
                .category("BILLETERA")
                .textEmbedding(List.of(0.3f, 0.4f, 0.5f))
                .build();

        repository().add(lo);

        verify(weaviateService).createObject(objectCaptor.capture());
        WeaviateObject stored = objectCaptor.getValue();

        assertThat(stored.getVectors()).containsOnlyKeys("text");
        assertThat(stored.getVectors().get("text")).containsExactly(0.3f, 0.4f, 0.5f);
        assertThat(stored.getProperties()).containsEntry("category", "BILLETERA");
    }

    @Test
    void query_searchesAgainstTextVector_andMapsCategoryBack() {
        WeaviateObject result = WeaviateObject.builder()
                .id("lo-1")
                .properties(new HashMap<>(Map.of(
                        "username", "user@test.com",
                        "description", "billetera negra",
                        "category", "BILLETERA")))
                .additional(Map.of("certainty", 0.8d))
                .build();
        when(weaviateService.queryObjects(anyString(), any(), anyString(), any(), any(), any(), any()))
                .thenReturn(List.of(result));

        List<LostObject> found = repository()
                .query(List.of(0.1f, 0.2f), null, null, null, null);

        assertThat(found).hasSize(1);
        assertThat(found.get(0).getCategory()).isEqualTo("BILLETERA");
        assertThat(found.get(0).getScore()).isEqualTo(0.8f);
        // La búsqueda inversa (texto) apunta al vector nombrado "text".
        verify(weaviateService).queryObjects(eq("LostObject"), any(), eq("text"), any(), any(), any(), any());
    }

    private static WeaviateObject candidate(String uuid, double certainty) {
        return WeaviateObject.builder()
                .id(uuid)
                .properties(new HashMap<>(Map.of(
                        "username", "user@test.com",
                        "description", "billetera negra",
                        "category", "BILLETERA")))
                .additional(Map.of("certainty", certainty))
                .build();
    }

    @Test
    void queryDual_mergesByUuid_exposingBothCertainties() {
        // lo-1 aparece por ambas modalidades; lo-2 sólo por imagen; lo-3 sólo por texto.
        when(weaviateService.queryObjects(eq("LostObject"), any(), eq("image"), any(), any(), any(), any()))
                .thenReturn(List.of(candidate("lo-1", 0.9d), candidate("lo-2", 0.8d)));
        when(weaviateService.queryObjects(eq("LostObject"), any(), eq("text"), any(), any(), any(), any()))
                .thenReturn(List.of(candidate("lo-1", 0.7d), candidate("lo-3", 0.6d)));

        List<LostObject> found = repository().queryDual(
                List.of(0.1f, 0.2f), List.of(0.3f, 0.4f), null, null, null, null, null, null);

        assertThat(found).extracting(LostObject::getUuid).containsExactly("lo-1", "lo-2", "lo-3");
        assertThat(found).extracting(LostObject::getScore).containsOnlyNulls();

        assertThat(found.get(0).getImageCertainty()).isEqualTo(0.9f);
        assertThat(found.get(0).getTextCertainty()).isEqualTo(0.7f);
        assertThat(found.get(1).getImageCertainty()).isEqualTo(0.8f);
        assertThat(found.get(1).getTextCertainty()).isNull();
        assertThat(found.get(2).getImageCertainty()).isNull();
        assertThat(found.get(2).getTextCertainty()).isEqualTo(0.6f);
    }

    @Test
    void queryDual_withoutImageVector_queriesOnlyText() {
        when(weaviateService.queryObjects(eq("LostObject"), any(), eq("text"), any(), any(), any(), any()))
                .thenReturn(List.of(candidate("lo-1", 0.7d)));

        List<LostObject> found = repository().queryDual(
                null, List.of(0.3f, 0.4f), null, null, null, null, null, null);

        assertThat(found).hasSize(1);
        assertThat(found.get(0).getImageCertainty()).isNull();
        assertThat(found.get(0).getTextCertainty()).isEqualTo(0.7f);
        verify(weaviateService, never()).queryObjects(eq("LostObject"), any(), eq("image"), any(), any(), any(), any());
    }
}
