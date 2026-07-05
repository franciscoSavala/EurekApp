package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.FoundObject;
import com.eurekapp.backend.model.GeoCoordinates;
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
        return new FoundObjectRepository(weaviateService, userRepository);
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

    @Test
    void namedVectors_omitsNullAndEmptyEntries() {
        assertThat(FoundObjectRepository.namedVectors(null, List.of(1f))).containsOnlyKeys("text");
        assertThat(FoundObjectRepository.namedVectors(List.of(), List.of(1f))).containsOnlyKeys("text");
        assertThat(FoundObjectRepository.namedVectors(List.of(1f), null)).containsOnlyKeys("image");
        assertThat(FoundObjectRepository.namedVectors(null, null)).isEmpty();
    }
}
