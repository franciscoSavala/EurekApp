package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.FoundObjectsListDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.model.FoundObject;
import com.eurekapp.backend.model.GeoCoordinates;
import com.eurekapp.backend.model.ObjectCategory;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.SimilarObjectsCommand;
import com.eurekapp.backend.repository.FoundObjectRepository;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.ObjectStorage;
import com.eurekapp.backend.service.client.EmbeddingService;
import com.eurekapp.backend.service.client.ImageClassificationService;
import com.eurekapp.backend.service.client.ImageEmbeddingService;
import com.eurekapp.backend.service.client.TextClassificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mock.web.MockMultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Tests de la búsqueda de objetos encontrados, por texto y por foto + texto. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FoundObjectSearchServiceTest {

    @Mock ObjectStorage s3Service;
    @Mock EmbeddingService embeddingService;
    @Mock ImageEmbeddingService imageEmbeddingService;
    @Mock ImageClassificationService imageClassificationService;
    @Mock TextClassificationService textClassificationService;
    @Mock IOrganizationRepository organizationRepository;
    @Mock OrganizationService organizationService;
    @Mock FoundObjectRepository foundObjectRepository;
    @Mock SearchScoringService searchScoringService;

    FoundObjectSearchService service;

    @BeforeEach
    void setUp() {
        // El mapper es real: así los tests ven el DTO tal como sale a la API.
        FoundObjectDtoMapper dtoMapper = new FoundObjectDtoMapper(s3Service, organizationRepository, organizationService);
        service = new FoundObjectSearchService(embeddingService, imageEmbeddingService,
                imageClassificationService, textClassificationService, organizationRepository,
                foundObjectRepository, searchScoringService, dtoMapper);
    }

    private static final GeoCoordinates CORDOBA =
            GeoCoordinates.builder().latitude(-31.4201).longitude(-64.1888).build();

    // ---- searchByPhoto (EU-324-D): búsqueda en vivo = foto + texto + ubicación, con CLIP + categoría IA ----


    @Test
    void searchByPhoto_withoutQuery_throwsBadRequest() {
        MockMultipartFile photo = new MockMultipartFile("file", new byte[]{1, 2, 3});
        SimilarObjectsCommand filters = SimilarObjectsCommand.builder().organizationId(1L).build();

        assertThatThrownBy(() -> service.searchByPhoto(photo, "   ", filters))
                .isInstanceOf(BadRequestException.class);

        verify(foundObjectRepository, never())
                .queryDual(any(), any(), any(), any(), any(), any(), anyBoolean(), any(), anyInt(), any());
    }

    @Test
    void searchByPhoto_withoutLocation_throwsBadRequest() {
        MockMultipartFile photo = new MockMultipartFile("file", new byte[]{1, 2, 3});
        // Sin organización y sin coordenadas: no se puede circunscribir el radio.
        SimilarObjectsCommand filters = SimilarObjectsCommand.builder().build();

        assertThatThrownBy(() -> service.searchByPhoto(photo, "billetera marrón", filters))
                .isInstanceOf(BadRequestException.class);

        verify(foundObjectRepository, never())
                .queryDual(any(), any(), any(), any(), any(), any(), anyBoolean(), any(), anyInt(), any());
    }

    @Test
    void searchByPhoto_happyPath_classifiesVectorizesAndReturnsCategory() {
        MockMultipartFile photo = new MockMultipartFile("file", new byte[]{1, 2, 3});
        SimilarObjectsCommand filters = SimilarObjectsCommand.builder().organizationId(1L).build();

        Organization org = mock(Organization.class);
        when(org.getCoordinates()).thenReturn(CORDOBA);
        when(organizationRepository.existsById(1L)).thenReturn(true);
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(org));

        when(imageEmbeddingService.getImageVectorRepresentation(any())).thenReturn(List.of(0.4f, 0.5f));
        when(imageClassificationService.classify(any())).thenReturn(ObjectCategory.BILLETERA);
        when(embeddingService.getTextVectorRepresentation(anyString())).thenReturn(List.of(0.1f, 0.2f));

        FoundObject candidate = FoundObject.builder()
                .uuid("fo-1").title("Billetera marrón").humanDescription("cuero")
                .organizationId("1").coordinates(CORDOBA).foundDate(LocalDateTime.now())
                .imageCertainty(0.95f).textCertainty(0.9f).category(ObjectCategory.BILLETERA.name())
                .build();
        when(foundObjectRepository.queryDual(any(), any(), any(), any(), any(), any(), anyBoolean(), any(), anyInt(), any()))
                .thenReturn(List.of(candidate));

        // El puntaje combinado y el umbral los decide SearchScoringService (aquí mockeado).
        when(searchScoringService.combinedScore(any(), any(), any(), any(), any())).thenReturn(0.9);
        when(searchScoringService.isCombinedMatch(anyDouble(), any())).thenReturn(true);
        // EU-327: el puntaje que llega al DTO es el remapeado para mostrar (curva monótona).
        when(searchScoringService.displayScore(anyDouble(), any())).thenReturn(0.95);
        when(s3Service.generatePresignedUrl(anyString(), any())).thenReturn("http://img/fo-1.jpg");

        FoundObjectsListDto result = service.searchByPhoto(photo, "billetera marrón", filters);

        // Devuelve la categoría clasificada por IA (para mostrarla read-only) y el candidato que superó el umbral.
        assertThat(result.getCategory()).isEqualTo(ObjectCategory.BILLETERA.name());
        assertThat(result.getFoundObjects()).hasSize(1);
        assertThat(result.getFoundObjects().get(0).getId()).isEqualTo("fo-1");
        // El puntaje que sale al front es el de PRESENTACIÓN, no el crudo del scoring.
        assertThat(result.getFoundObjects().get(0).getScore()).isEqualTo(0.95f);
        // Recupera candidatos con AMBOS vectores (imagen + texto), no la query textual legacy.
        verify(foundObjectRepository)
                .queryDual(any(), any(), any(), any(), any(), any(), anyBoolean(), any(), anyInt(), any());
    }

    // ---- EU-142: normalización del texto que alimenta el vector (misma limpieza en ambos lados) ----

    @Test
    void searchByPhoto_normalizesQueryBeforeEmbedding() {
        MockMultipartFile photo = new MockMultipartFile("file", new byte[]{1, 2, 3});
        SimilarObjectsCommand filters = SimilarObjectsCommand.builder().organizationId(1L).build();

        Organization org = mock(Organization.class);
        when(org.getCoordinates()).thenReturn(CORDOBA);
        when(organizationRepository.existsById(1L)).thenReturn(true);
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(org));
        when(imageEmbeddingService.getImageVectorRepresentation(any())).thenReturn(List.of(0.4f, 0.5f));
        when(imageClassificationService.classify(any())).thenReturn(ObjectCategory.BILLETERA);
        when(embeddingService.getTextVectorRepresentation(anyString())).thenReturn(List.of(0.1f, 0.2f));
        when(foundObjectRepository.queryDual(any(), any(), any(), any(), any(), any(), anyBoolean(), any(), anyInt(), any()))
                .thenReturn(List.of());

        service.searchByPhoto(photo, "Billétera Marrón", filters);

        // La query se normaliza (minúsculas, tildes) antes de vectorizar, igual que el texto persistido.
        ArgumentCaptor<String> textToEmbed = ArgumentCaptor.forClass(String.class);
        verify(embeddingService).getTextVectorRepresentation(textToEmbed.capture());
        assertThat(textToEmbed.getValue()).isEqualTo("billetera marron");
    }

    // ---- Puntaje de las búsquedas: se filtra por el umbral CRUDO y recién después se remapea ----

    private static final GeoCoordinates CARLOS_PAZ =
            GeoCoordinates.builder().latitude(-31.4241).longitude(-64.4978).build();

    /**
     * Simula el scoring: el puntaje crudo de cada candidato es su certeza de texto; el umbral crudo es 0.5 en
     * la búsqueda sólo texto y 0.6 en la búsqueda con foto; el puntaje para mostrar es la mitad del crudo en
     * sólo texto y la cuarta parte en foto (así se nota si se usó el modo equivocado).
     */
    private void stubScoringPorModo() {
        when(searchScoringService.combinedScore(any(), any(), any(), any(), any()))
                .thenAnswer(inv -> ((Float) inv.getArgument(1)).doubleValue());
        when(searchScoringService.isCombinedMatch(anyDouble(), any())).thenAnswer(inv ->
                (double) inv.getArgument(0) >= (inv.getArgument(1) == SearchScoringService.SearchMode.TEXT_ONLY ? 0.5 : 0.6));
        when(searchScoringService.displayScore(anyDouble(), any())).thenAnswer(inv ->
                (double) inv.getArgument(0) * (inv.getArgument(1) == SearchScoringService.SearchMode.TEXT_ONLY ? 0.5 : 0.25));
        when(s3Service.generatePresignedUrl(anyString(), any())).thenReturn("http://img/x.jpg");
    }

    private FoundObject candidato(String uuid, float certezaTexto, GeoCoordinates coords) {
        return FoundObject.builder()
                .uuid(uuid).title(uuid).humanDescription("d").organizationId("1")
                .coordinates(coords).foundDate(LocalDateTime.now())
                .imageCertainty(0.9f).textCertainty(certezaTexto).score(certezaTexto)
                .category(ObjectCategory.BILLETERA.name())
                .build();
    }

    private void stubOrganizacionYBusqueda() {
        Organization org = mock(Organization.class);
        when(org.getCoordinates()).thenReturn(CORDOBA);
        when(organizationRepository.existsById(1L)).thenReturn(true);
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(org));
    }

    @Test
    void busquedaSoloTexto_descartaLoQueNoLlegaAlUmbralCrudo_ordenaDescendenteYDevuelvePuntajeParaMostrar() {
        stubOrganizacionYBusqueda();
        stubScoringPorModo();
        when(embeddingService.getTextVectorRepresentation(anyString())).thenReturn(List.of(0.1f));
        when(textClassificationService.classify(any())).thenReturn(ObjectCategory.BILLETERA);
        // Crudo 0.55 y 0.9 superan 0.5; 0.4 no. Se entregan desordenados a propósito.
        when(foundObjectRepository.query(any(), any(), any(), any(), any(), anyBoolean(), any()))
                .thenReturn(List.of(candidato("bajo", 0.55f, CORDOBA), candidato("descartado", 0.4f, CORDOBA),
                        candidato("alto", 0.9f, CARLOS_PAZ)));

        SimilarObjectsCommand cmd = SimilarObjectsCommand.builder().organizationId(1L).query("billetera").build();
        FoundObjectsListDto result = service.getFoundObjectByTextDescription(cmd);

        assertThat(result.getFoundObjects()).extracting(o -> o.getId()).containsExactly("alto", "bajo");
        // El puntaje mostrado es el remapeado del modo sólo texto (mitad del crudo), no el crudo.
        assertThat(result.getFoundObjects().get(0).getScore()).isEqualTo(0.45f);
        assertThat(result.getFoundObjects().get(1).getScore()).isEqualTo(0.275f);
        // Se mide con el umbral del modo sólo texto y nunca con el de foto.
        verify(searchScoringService, never()).isCombinedMatch(anyDouble(), eq(SearchScoringService.SearchMode.WITH_PHOTO));
        // La distancia al punto de búsqueda se completa para cada resultado.
        assertThat(result.getFoundObjects().get(0).getDistance())
                .isEqualTo(CommonFunctions.calculateGeoDistance(CARLOS_PAZ, CORDOBA).floatValue());
        assertThat(result.getFoundObjects().get(1).getDistance())
                .isEqualTo(CommonFunctions.calculateGeoDistance(CORDOBA, CORDOBA).floatValue());
    }

    @Test
    void busquedaConFoto_descartaLoQueNoLlegaAlUmbralCrudo_ordenaDescendenteYDevuelvePuntajeParaMostrar() {
        stubOrganizacionYBusqueda();
        stubScoringPorModo();
        when(imageEmbeddingService.getImageVectorRepresentation(any())).thenReturn(List.of(0.4f));
        when(imageClassificationService.classify(any())).thenReturn(ObjectCategory.BILLETERA);
        when(embeddingService.getTextVectorRepresentation(anyString())).thenReturn(List.of(0.1f));
        // 0.55 supera el umbral de sólo texto (0.5) pero NO el de foto (0.6): con foto se descarta.
        when(foundObjectRepository.queryDual(any(), any(), any(), any(), any(), any(), anyBoolean(), any(), anyInt(), any()))
                .thenReturn(List.of(candidato("medio", 0.7f, CORDOBA), candidato("descartado", 0.55f, CORDOBA),
                        candidato("alto", 0.95f, CARLOS_PAZ)));

        MockMultipartFile photo = new MockMultipartFile("file", new byte[]{1, 2, 3});
        FoundObjectsListDto result = service.searchByPhoto(photo, "billetera",
                SimilarObjectsCommand.builder().organizationId(1L).build());

        assertThat(result.getFoundObjects()).extracting(o -> o.getId()).containsExactly("alto", "medio");
        // Puntaje remapeado del modo con foto (cuarta parte del crudo).
        assertThat(result.getFoundObjects().get(0).getScore()).isEqualTo(0.2375f);
        assertThat(result.getFoundObjects().get(1).getScore()).isEqualTo(0.175f);
        verify(searchScoringService, never()).isCombinedMatch(anyDouble(), eq(SearchScoringService.SearchMode.TEXT_ONLY));
        assertThat(result.getFoundObjects().get(0).getDistance())
                .isEqualTo(CommonFunctions.calculateGeoDistance(CARLOS_PAZ, CORDOBA).floatValue());
        assertThat(result.getFoundObjects().get(1).getDistance())
                .isEqualTo(CommonFunctions.calculateGeoDistance(CORDOBA, CORDOBA).floatValue());
    }

    @Test
    void busquedas_elUmbralSeAplicaAlPuntajeCrudoNoAlRemapeado() {
        stubOrganizacionYBusqueda();
        stubScoringPorModo();
        when(embeddingService.getTextVectorRepresentation(anyString())).thenReturn(List.of(0.1f));
        when(textClassificationService.classify(any())).thenReturn(ObjectCategory.BILLETERA);
        when(foundObjectRepository.query(any(), any(), any(), any(), any(), anyBoolean(), any()))
                .thenReturn(List.of(candidato("justo", 0.5f, CORDOBA)));

        FoundObjectsListDto result = service.getFoundObjectByTextDescription(
                SimilarObjectsCommand.builder().organizationId(1L).query("billetera").build());

        // 0.5 crudo llega justo al umbral; su valor remapeado (0.25) quedaría por debajo y no debe importar.
        assertThat(result.getFoundObjects()).hasSize(1);
        verify(searchScoringService, never()).isCombinedMatch(eq(0.25), any());
    }

    // ---- Filtros y validaciones de las búsquedas (categoría, organización, fechas, ubicación) ----

    @Test
    void busquedaSoloTexto_sinOrganizacionNiCoordenadas_esRechazada() {
        SimilarObjectsCommand cmd = SimilarObjectsCommand.builder().query("billetera").build();

        assertThatThrownBy(() -> service.getFoundObjectByTextDescription(cmd))
                .isInstanceOf(com.eurekapp.backend.exception.ApiException.class);

        verify(foundObjectRepository, never()).query(any(), any(), any(), any(), any(), anyBoolean(), any());
    }

    @Test
    void busquedaSoloTexto_conOrganizacion_filtraPorOrganizacionFechasYCategoriaDeducidaDelTexto() {
        stubOrganizacionYBusqueda();
        when(embeddingService.getTextVectorRepresentation(anyString())).thenReturn(List.of(0.1f));
        when(textClassificationService.classify(any())).thenReturn(ObjectCategory.LLAVES);
        when(foundObjectRepository.query(any(), any(), any(), any(), any(), anyBoolean(), any())).thenReturn(List.of());
        LocalDateTime desde = LocalDateTime.of(2026, 8, 1, 0, 0);
        LocalDateTime hasta = LocalDateTime.of(2026, 8, 31, 0, 0);

        FoundObjectsListDto result = service.getFoundObjectByTextDescription(SimilarObjectsCommand.builder()
                .organizationId(1L).query("llaves").lostDate(desde).lostDateTo(hasta).build());

        // Pide solo objetos no devueltos de esa organización, con las coordenadas de la organización,
        // el rango de fechas y la categoría que dedujo la IA del texto.
        verify(foundObjectRepository).query(eq(List.of(0.1f)), eq("1"), eq(CORDOBA), eq(desde), eq(hasta),
                eq(false), eq(ObjectCategory.LLAVES.name()));
        assertThat(result.getCategory()).isEqualTo(ObjectCategory.LLAVES.name());
    }

    @Test
    void busquedaSoloTexto_porCoordenadas_usaLasCoordenadasDelPedidoYNoFiltraCategoriaSiLaIaSeAbstiene() {
        when(embeddingService.getTextVectorRepresentation(anyString())).thenReturn(List.of(0.1f));
        when(textClassificationService.classify(any())).thenReturn(null);
        when(foundObjectRepository.query(any(), any(), any(), any(), any(), anyBoolean(), any())).thenReturn(List.of());

        FoundObjectsListDto result = service.getFoundObjectByTextDescription(SimilarObjectsCommand.builder()
                .latitude(CORDOBA.getLatitude()).longitude(CORDOBA.getLongitude()).query("algo raro").build());

        // Sin organización el filtro de organización va nulo, la ubicación es la del pedido y,
        // si la IA no reconoce el objeto, no se filtra por categoría.
        verify(foundObjectRepository).query(any(), eq((String) null), eq(CORDOBA), any(), any(),
                eq(false), eq((String) null));
        assertThat(result.getCategory()).isNull();
        assertThat(result.getFoundObjects()).isEmpty();
    }

    @Test
    void busquedaSoloTexto_conTextoVacio_noVectorizaYBuscaSinVector() {
        stubOrganizacionYBusqueda();
        when(textClassificationService.classify(any())).thenReturn(null);
        when(foundObjectRepository.query(any(), any(), any(), any(), any(), anyBoolean(), any())).thenReturn(List.of());

        service.getFoundObjectByTextDescription(SimilarObjectsCommand.builder().organizationId(1L).query("  ").build());

        verify(embeddingService, never()).getTextVectorRepresentation(anyString());
        verify(foundObjectRepository).query(eq((List<Float>) null), eq("1"), any(), any(), any(),
                eq(false), eq((String) null));
    }

    @Test
    void busquedaConFoto_sinFoto_esRechazada() {
        SimilarObjectsCommand filters = SimilarObjectsCommand.builder().organizationId(1L).build();

        assertThatThrownBy(() -> service.searchByPhoto(null, "billetera", filters))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.searchByPhoto(new MockMultipartFile("file", new byte[0]), "billetera", filters))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void busquedaConFoto_siElTextoNombraElObjeto_laCategoriaLaDecideElTextoYNoLaFoto() {
        stubOrganizacionYBusqueda();
        when(imageEmbeddingService.getImageVectorRepresentation(any())).thenReturn(List.of(0.4f));
        when(imageClassificationService.classify(any())).thenReturn(ObjectCategory.BILLETERA);
        when(textClassificationService.classify(any())).thenReturn(ObjectCategory.LLAVES);
        when(embeddingService.getTextVectorRepresentation(anyString())).thenReturn(List.of(0.1f));
        when(foundObjectRepository.queryDual(any(), any(), any(), any(), any(), any(), anyBoolean(), any(), anyInt(), any()))
                .thenReturn(List.of());
        LocalDateTime desde = LocalDateTime.of(2026, 8, 1, 0, 0);
        LocalDateTime hasta = LocalDateTime.of(2026, 8, 31, 0, 0);

        FoundObjectsListDto result = service.searchByPhoto(new MockMultipartFile("file", new byte[]{1, 2, 3}), "llaves",
                SimilarObjectsCommand.builder().organizationId(1L).lostDate(desde).lostDateTo(hasta).build());

        assertThat(result.getCategory()).isEqualTo(ObjectCategory.LLAVES.name());
        verify(foundObjectRepository).queryDual(eq(List.of(0.4f)), eq(List.of(0.1f)), eq("1"), eq(CORDOBA),
                eq(desde), eq(hasta), eq(false), eq(ObjectCategory.LLAVES.name()), anyInt(), any());
    }

    @Test
    void busquedaConFoto_siElTextoNoNombraElObjeto_laCategoriaLaDecideLaFoto() {
        when(imageEmbeddingService.getImageVectorRepresentation(any())).thenReturn(List.of(0.4f));
        when(imageClassificationService.classify(any())).thenReturn(ObjectCategory.BILLETERA);
        when(textClassificationService.classify(any())).thenReturn(null);
        when(embeddingService.getTextVectorRepresentation(anyString())).thenReturn(List.of(0.1f));
        when(foundObjectRepository.queryDual(any(), any(), any(), any(), any(), any(), anyBoolean(), any(), anyInt(), any()))
                .thenReturn(List.of());

        FoundObjectsListDto result = service.searchByPhoto(new MockMultipartFile("file", new byte[]{1, 2, 3}), "cosa marron",
                SimilarObjectsCommand.builder().latitude(CORDOBA.getLatitude()).longitude(CORDOBA.getLongitude()).build());

        // Búsqueda por coordenadas: sin organización y con la ubicación del pedido.
        assertThat(result.getCategory()).isEqualTo(ObjectCategory.BILLETERA.name());
        verify(foundObjectRepository).queryDual(any(), any(), eq((String) null), eq(CORDOBA), any(), any(),
                eq(false), eq(ObjectCategory.BILLETERA.name()), anyInt(), any());
    }

}
