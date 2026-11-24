package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.FoundObjectsListDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.model.FoundObject;
import com.eurekapp.backend.model.GeoCoordinates;
import com.eurekapp.backend.model.ObjectCategory;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.ReturnFoundObject;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.SimilarObjectsCommand;
import com.eurekapp.backend.model.UploadFoundObjectCommand;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.FoundObjectRepository;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.IRewardExclusionRepository;
import com.eurekapp.backend.repository.IReturnFoundObjectRepository;
import com.eurekapp.backend.repository.IUserRepository;
import com.eurekapp.backend.repository.ObjectStorage;
import com.eurekapp.backend.service.client.EmbeddingService;
import com.eurekapp.backend.service.client.ImageClassificationService;
import com.eurekapp.backend.service.client.TextClassificationService;
import com.eurekapp.backend.service.client.ImageDescriptionService;
import com.eurekapp.backend.service.client.ImageEmbeddingService;
import com.eurekapp.backend.service.notification.NotificationService;
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
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import java.util.Optional;

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

/**
 * Tests del alta de objeto encontrado (EU-286, pieza de validación de bloqueo en alta): un finder
 * bloqueado por sospecha de fraude no puede depositar objetos.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FoundObjectServiceTest {

    @Mock ObjectStorage s3Service;
    @Mock ImageDescriptionService descriptionService;
    @Mock EmbeddingService embeddingService;
    @Mock ImageEmbeddingService imageEmbeddingService;
    @Mock ImageClassificationService imageClassificationService;
    @Mock TextClassificationService textClassificationService;
    @Mock IOrganizationRepository organizationRepository;
    @Mock LostObjectService lostObjectService;
    @Mock ExecutorService executorService;
    @Mock FoundObjectRepository foundObjectRepository;
    @Mock IUserRepository userRepository;
    @Mock IRewardExclusionRepository rewardExclusionRepository;
    @Mock IReturnFoundObjectRepository returnFoundObjectRepository;
    @Mock NotificationService notificationService;
    @Mock EmailTemplateService emailTemplateService;
    @Mock FraudBlockService fraudBlockService;
    @Mock OrganizationService organizationService;
    @Mock com.eurekapp.backend.repository.IOrganizationPolicyRepository policyRepository;

    static final java.time.ZoneId ZONA = java.time.ZoneId.of("America/Argentina/Cordoba");
    static final LocalDateTime AHORA = LocalDateTime.of(2026, 11, 24, 12, 0);
    java.time.Clock reloj;

    FoundObjectService service;

    @BeforeEach
    void setUp() {
        reloj = java.time.Clock.fixed(AHORA.atZone(ZONA).toInstant(), ZONA);
        FoundObjectDtoMapper dtoMapper = new FoundObjectDtoMapper(s3Service, organizationRepository, organizationService);
        service = new FoundObjectService(
                s3Service, descriptionService, embeddingService, imageEmbeddingService,
                imageClassificationService, textClassificationService, organizationRepository,
                lostObjectService, executorService, foundObjectRepository,
                userRepository, rewardExclusionRepository, returnFoundObjectRepository,
                notificationService,
                emailTemplateService, fraudBlockService, dtoMapper,
                new StoragePeriodService(policyRepository, reloj), reloj);
    }

    @Test
    void uploadFails_whenFinderIsBlocked() {
        UserEurekapp finder = UserEurekapp.builder()
                .id(99L).username("finder@test.com").firstName("Fin").lastName("Der")
                .role(Role.USER).build();

        UploadFoundObjectCommand command = UploadFoundObjectCommand.builder()
                .title("Mochila azul")
                .objectFinderUsername("finder@test.com")
                .foundDate(LocalDateTime.now().minusDays(1))
                .detailedDescription("desc")
                .organizationId(1L)
                .image(new MockMultipartFile("img", new byte[]{1, 2, 3}))
                .build();

        when(organizationRepository.existsById(1L)).thenReturn(true);
        when(userRepository.existsByUsername("finder@test.com")).thenReturn(true);
        when(userRepository.getByUsername("finder@test.com")).thenReturn(finder);
        // El finder está bloqueado por sospecha de fraude (con mensaje humano).
        when(fraudBlockService.describeActiveUserBlock(eq(99L), anyString()))
                .thenReturn(Optional.of("Quien encontró este objeto está temporalmente bloqueado."));

        assertThatThrownBy(() -> service.uploadFoundObject(command))
                .isInstanceOf(BadRequestException.class);

        // Se rechaza antes de persistir el objeto.
        verify(foundObjectRepository, never()).add(any());
    }

    @Test
    void uploadFails_whenTitleExceeds100Characters() {
        UploadFoundObjectCommand command = UploadFoundObjectCommand.builder()
                .title("x".repeat(101))
                .foundDate(LocalDateTime.now().minusDays(1))
                .organizationId(1L)
                .image(new MockMultipartFile("img", new byte[]{1, 2, 3}))
                .build();
        when(organizationRepository.existsById(1L)).thenReturn(true);

        assertThatThrownBy(() -> service.uploadFoundObject(command))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("El título no puede superar los 100 caracteres");
        verify(foundObjectRepository, never()).add(any());
    }

    private static final GeoCoordinates CORDOBA =
            GeoCoordinates.builder().latitude(-31.4201).longitude(-64.1888).build();

    @Test
    void uploadFoundObject_normalizesTextBeforeEmbedding() {
        UploadFoundObjectCommand command = UploadFoundObjectCommand.builder()
                .title("Billétera Roja")
                .detailedDescription("DNI 40.682.351")
                .foundDate(LocalDateTime.now().minusDays(1))
                .latitude(CORDOBA.getLatitude())
                .longitude(CORDOBA.getLongitude())
                .organizationId(1L)
                .image(new MockMultipartFile("img", new byte[]{1, 2, 3}))
                .build();

        when(organizationRepository.existsById(1L)).thenReturn(true);
        when(imageEmbeddingService.getImageVectorRepresentation(any())).thenReturn(List.of(0.4f, 0.5f));
        when(imageClassificationService.classify(any())).thenReturn(ObjectCategory.BILLETERA);
        when(embeddingService.getTextVectorRepresentation(anyString())).thenReturn(List.of(0.1f, 0.2f));
        when(executorService.submit(any(Runnable.class))).thenReturn(CompletableFuture.completedFuture(null));

        service.uploadFoundObject(command);

        // El vector se calcula sobre título+descripción normalizados: minúsculas, sin tildes y con el
        // DNI sin puntos ("40.682.351" -> "40682351"), para que el mismo dato escrito distinto coincida.
        ArgumentCaptor<String> textToEmbed = ArgumentCaptor.forClass(String.class);
        verify(embeddingService).getTextVectorRepresentation(textToEmbed.capture());
        assertThat(textToEmbed.getValue()).isEqualTo("dni 40682351 billetera roja");
    }

    // ---- EU-348: el historial se ordena por CUÁNDO SE DEVOLVIÓ, no por cuándo se encontró ----

    /** Objeto devuelto de la organización 1, con la fecha de hallazgo dada. */
    private FoundObject returnedObject(String uuid, String title, LocalDateTime foundDate) {
        return FoundObject.builder()
                .uuid(uuid)
                .title(title)
                .humanDescription("desc " + title)
                .organizationId("1")
                .foundDate(foundDate)
                .wasReturned(true)
                .build();
    }

    private ReturnFoundObject returnRecord(String uuid, LocalDateTime returnedAt) {
        ReturnFoundObject rfo = new ReturnFoundObject();
        rfo.setFoundObjectUUID(uuid);
        rfo.setDatetimeOfReturn(returnedAt);
        return rfo;
    }

    private UserEurekapp orgUser() {
        Organization org = Organization.builder().id(1L).name("UTN FRC").build();
        return UserEurekapp.builder()
                .id(1L).username("owner@test.com").role(Role.ORGANIZATION_OWNER)
                .organization(org).build();
    }

    private void devolucionesDeLaOrg(List<FoundObject> objetos, List<ReturnFoundObject> devoluciones) {
        when(returnFoundObjectRepository.findMostRecentByOrganization(eq(1L), any())).thenReturn(devoluciones);
        when(foundObjectRepository.getByUuids(any())).thenReturn(
                objetos.stream().collect(java.util.stream.Collectors.toMap(FoundObject::getUuid, o -> o)));
        when(organizationRepository.findById(1L)).thenReturn(Optional.empty());
    }

    @Test
    void returnedObjects_followTheOrderOfTheMostRecentReturns() {
        /* El objeto encontrado MÁS RECIENTE es el que se devolvió PRIMERO. El historial arranca por la
         * última devolución, no por el último hallazgo. */
        FoundObject encontradoTarde = returnedObject("uuid-tarde", "Mochila roja",
                LocalDateTime.of(2026, 8, 24, 16, 0));
        FoundObject encontradoTemprano = returnedObject("uuid-temprano", "Auriculares Sony",
                LocalDateTime.of(2026, 8, 24, 10, 0));
        devolucionesDeLaOrg(List.of(encontradoTarde, encontradoTemprano), List.of(
                returnRecord("uuid-temprano", LocalDateTime.of(2026, 8, 24, 23, 26)),
                returnRecord("uuid-tarde", LocalDateTime.of(2026, 8, 24, 20, 0))));

        FoundObjectsListDto result = service.getAllReturnedFoundObjectsByOrganization(orgUser());

        assertThat(result.getFoundObjects()).extracting("id")
                .containsExactly("uuid-temprano", "uuid-tarde");
    }

    @Test
    void returnedObjects_exposeReturnDate() {
        FoundObject devuelto = returnedObject("uuid-1", "Paraguas negro", LocalDateTime.of(2026, 4, 15, 10, 0));
        LocalDateTime devueltoEl = LocalDateTime.of(2026, 8, 24, 23, 28);
        devolucionesDeLaOrg(List.of(devuelto), List.of(returnRecord("uuid-1", devueltoEl)));

        FoundObjectsListDto result = service.getAllReturnedFoundObjectsByOrganization(orgUser());

        assertThat(result.getFoundObjects()).hasSize(1);
        assertThat(result.getFoundObjects().get(0).getReturnDate()).isEqualTo(devueltoEl);
        // Los fixtures no tienen coordenadas a propósito: el dato ausente viaja como null y no rompe el listado.
        assertThat(result.getFoundObjects().get(0).getLatitude()).isNull();
    }

    @Test
    void returnedObjects_askForTheMostRecentReturnsWithALimitAbove25() {
        // EU-441: sin ordenar por fecha antes de recortar, la última devolución podía quedar afuera.
        devolucionesDeLaOrg(List.of(), List.of());

        service.getAllReturnedFoundObjectsByOrganization(orgUser());

        org.mockito.ArgumentCaptor<org.springframework.data.domain.Pageable> pagina =
                org.mockito.ArgumentCaptor.forClass(org.springframework.data.domain.Pageable.class);
        org.mockito.Mockito.verify(returnFoundObjectRepository).findMostRecentByOrganization(eq(1L), pagina.capture());
        assertThat(pagina.getValue().getPageSize()).isGreaterThan(25);
    }

    @Test
    void returnedObjects_aDevolutionWhoseObjectIsMissingDoesNotBreakTheList() {
        FoundObject ok = returnedObject("uuid-ok", "Billetera rosa", LocalDateTime.of(2026, 5, 1, 10, 0));
        devolucionesDeLaOrg(List.of(ok), List.of(
                returnRecord("uuid-perdido", LocalDateTime.of(2026, 8, 24, 23, 0)),
                returnRecord("uuid-ok", LocalDateTime.of(2026, 8, 24, 22, 0))));

        FoundObjectsListDto result = service.getAllReturnedFoundObjectsByOrganization(orgUser());

        assertThat(result.getFoundObjects()).extracting("id").containsExactly("uuid-ok");
    }


    // ---- EU-452: plazo de guarda ----

    private void plazoDeLaOrganizacion(Integer dias) {
        when(policyRepository.findByOrganization_Id(1L)).thenReturn(java.util.Optional.of(
                com.eurekapp.backend.model.OrganizationPolicy.builder().maxStorageDays(dias).build()));
    }

    private FoundObject guardado(String uuid, LocalDateTime encontrado) {
        return FoundObject.builder().uuid(uuid).title(uuid).humanDescription("d").organizationId("1")
                .foundDate(encontrado).wasReturned(false).build();
    }

    @Test
    void detalle_traeElEstadoYLaFechaDeVencimientoDelPlazoDeGuarda() {
        plazoDeLaOrganizacion(30);
        LocalDateTime hallazgo = AHORA.minusDays(25);
        when(foundObjectRepository.getByUuid("fo-1")).thenReturn(guardado("fo-1", hallazgo));

        com.eurekapp.backend.dto.FoundObjectDto dto = service.getFoundObjectDetail(
                com.eurekapp.backend.dto.command.FoundObjectDetailCommand.builder().foundObjectUUID("fo-1").build());

        assertThat(dto.getStorageStatus()).isEqualTo(com.eurekapp.backend.model.StorageStatus.EXPIRING);
        assertThat(dto.getStorageExpiresAt()).isEqualTo(hallazgo.plusDays(30));
    }

    @Test
    void inventario_completaEstadoYVencimientoEnCadaObjeto() {
        plazoDeLaOrganizacion(30);
        LocalDateTime enPlazo = AHORA.minusDays(2);
        LocalDateTime vencido = AHORA.minusDays(40);
        when(foundObjectRepository.query(any(), any(), any(), any(), any(), anyBoolean(), any(), anyInt(), anyInt()))
                .thenReturn(List.of(guardado("a", enPlazo), guardado("b", vencido)));

        FoundObjectsListDto result = service.getAllUnreturnedFoundObjectsByOrganization(
                SimilarObjectsCommand.builder().organizationId(1L).build());

        assertThat(result.getFoundObjects()).extracting(o -> o.getStorageStatus())
                .containsExactly(com.eurekapp.backend.model.StorageStatus.IN_TERM,
                        com.eurekapp.backend.model.StorageStatus.EXPIRED);
        assertThat(result.getFoundObjects().get(0).getStorageExpiresAt()).isEqualTo(enPlazo.plusDays(30));
    }

    @Test
    void inventarioSoloVencidos_sinPlazoDevuelveVacioYNoConsultaWeaviate() {
        when(policyRepository.findByOrganization_Id(1L)).thenReturn(java.util.Optional.empty());

        FoundObjectsListDto result = service.getAllUnreturnedFoundObjectsByOrganization(
                SimilarObjectsCommand.builder().organizationId(1L).expiredOnly(true).build());

        assertThat(result.getFoundObjects()).isEmpty();
        assertThat(result.getHasMore()).isFalse();
        verify(foundObjectRepository, never()).query(any(), any(), any(), any(), any(), anyBoolean(), any(), anyInt(), anyInt());
    }

    @Test
    void inventarioSoloVencidos_conPlazoDe30Dias_pideObjetosEncontradosAntesDeAhoraMenos30Dias() {
        plazoDeLaOrganizacion(30);
        when(foundObjectRepository.query(any(), any(), any(), any(), any(), anyBoolean(), any(), anyInt(), anyInt()))
                .thenReturn(List.of());

        service.getAllUnreturnedFoundObjectsByOrganization(
                SimilarObjectsCommand.builder().organizationId(1L).expiredOnly(true).build());

        ArgumentCaptor<LocalDateTime> hasta = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(foundObjectRepository).query(any(), eq("1"), any(), any(), hasta.capture(), eq(false), any(), anyInt(), anyInt());
        assertThat(hasta.getValue()).isEqualTo(AHORA.minusDays(30));
    }
}
