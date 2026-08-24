package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.command.ReportLostObjectCommand;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.FoundObject;
import com.eurekapp.backend.model.ObjectCategory;
import com.eurekapp.backend.model.GeoCoordinates;
import com.eurekapp.backend.model.LostObject;
import com.eurekapp.backend.model.LostObjectStatus;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.IUserRepository;
import com.eurekapp.backend.repository.LostObjectRepository;
import com.eurekapp.backend.repository.ObjectStorage;
import com.eurekapp.backend.service.client.EmbeddingService;
import com.eurekapp.backend.service.client.ImageClassificationService;
import com.eurekapp.backend.service.client.TextClassificationService;
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
import com.eurekapp.backend.dto.response.LostObjectResponseDto;
import org.springframework.mock.web.MockMultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests de la búsqueda INVERSA (EU-279): al subir un objeto encontrado, se avisa a los dueños de
 * las búsquedas guardadas que coinciden (≥ umbral), uno por usuario con la lista de sus búsquedas.
 * Se usa el {@link SearchScoringService} real para que el corte sea el de producción (EU-327: el
 * umbral crudo calibrado, no el 0,75 que se le muestra al usuario).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LostObjectServiceTest {

    private static final GeoCoordinates CORDOBA =
            GeoCoordinates.builder().latitude(-31.4201).longitude(-64.1888).build();
    private static final GeoCoordinates BUENOS_AIRES =
            GeoCoordinates.builder().latitude(-34.6037).longitude(-58.3816).build();

    @Mock EmbeddingService embeddingService;
    @Mock ImageEmbeddingService imageEmbeddingService;
    @Mock ImageClassificationService imageClassificationService;
    @Mock TextClassificationService textClassificationService;
    @Mock EmailTemplateService emailTemplateService;
    @Mock NotificationService notificationService;
    @Mock IOrganizationRepository organizationRepository;
    @Mock ObjectStorage objectStorage;
    @Mock LostObjectRepository lostObjectRepository;
    @Mock IUserRepository userRepository;
    @Mock InAppNotificationService inAppNotificationService;

    LostObjectService service;

    @BeforeEach
    void setUp() {
        service = new LostObjectService(
                embeddingService, imageEmbeddingService, imageClassificationService,
                textClassificationService,
                emailTemplateService, notificationService, organizationRepository,
                objectStorage, lostObjectRepository, userRepository, inAppNotificationService,
                new SearchScoringService(new com.eurekapp.backend.configuration.ScoringProperties(), 50000.0));

        Organization organization = mock(Organization.class);
        when(organization.getName()).thenReturn("Org Test");
        when(organization.getContactData()).thenReturn("contacto@org.com");
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(organization));
        when(objectStorage.getObjectUrl(anyString())).thenReturn("http://img/found.jpg");
        when(emailTemplateService.buildObjectMatchFoundEmail(any(), any(), any(), any()))
                .thenReturn("<html>email</html>");
    }

    @Test
    void match_aboveThreshold_notifiesOwner() {
        FoundObject found = foundObjectAt(CORDOBA);
        LostObject search = savedSearch("u1@test.com", "mochila azul", 1.0f, CORDOBA);
        when(lostObjectRepository.queryDual(any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(List.of(search));
        when(userRepository.findByUsername("u1@test.com"))
                .thenReturn(Optional.of(user("u1@test.com", Role.USER)));

        service.notifyMatchingSavedSearches(found);

        verify(notificationService).sendNotification(eq("u1@test.com"), anyString(), anyString());
        verify(inAppNotificationService)
                .createNotification(any(UserEurekapp.class), anyString(), anyString(), eq("MATCH_FOUND"),
                        isNull(), eq("fo-1"), any(Double.class));
    }

    @Test
    void match_belowThreshold_doesNotNotify() {
        FoundObject found = foundObjectAt(CORDOBA);
        // Coseno bajo (0.6 => normalizado 0.2 => 0.19) y lejos => total muy por debajo de 0,75.
        LostObject search = savedSearch("u1@test.com", "algo", 0.6f, BUENOS_AIRES);
        when(lostObjectRepository.queryDual(any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(List.of(search));

        service.notifyMatchingSavedSearches(found);

        verify(notificationService, never()).sendNotification(any(), any(), any());
        verify(inAppNotificationService, never()).createNotification(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void multipleUsers_eachNotifiedOnce() {
        FoundObject found = foundObjectAt(CORDOBA);
        LostObject s1 = savedSearch("u1@test.com", "mochila", 1.0f, CORDOBA);
        LostObject s2 = savedSearch("u2@test.com", "cartera", 1.0f, CORDOBA);
        when(lostObjectRepository.queryDual(any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(List.of(s1, s2));
        when(userRepository.findByUsername("u1@test.com"))
                .thenReturn(Optional.of(user("u1@test.com", Role.USER)));
        when(userRepository.findByUsername("u2@test.com"))
                .thenReturn(Optional.of(user("u2@test.com", Role.USER)));

        service.notifyMatchingSavedSearches(found);

        verify(notificationService).sendNotification(eq("u1@test.com"), anyString(), anyString());
        verify(notificationService).sendNotification(eq("u2@test.com"), anyString(), anyString());
        verify(notificationService, times(2)).sendNotification(any(), any(), any());
        verify(inAppNotificationService, times(2))
                .createNotification(any(), any(), any(), eq("MATCH_FOUND"), isNull(), eq("fo-1"), any(Double.class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void sameUser_multipleMatches_singleNotificationListingAll() {
        FoundObject found = foundObjectAt(CORDOBA);
        LostObject s1 = savedSearch("u1@test.com", "mochila azul", 1.0f, CORDOBA);
        LostObject s2 = savedSearch("u1@test.com", "cartera negra", 1.0f, CORDOBA);
        when(lostObjectRepository.queryDual(any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(List.of(s1, s2));
        when(userRepository.findByUsername("u1@test.com"))
                .thenReturn(Optional.of(user("u1@test.com", Role.USER)));

        service.notifyMatchingSavedSearches(found);

        // Un solo aviso para el usuario, aunque tenga dos búsquedas coincidentes.
        verify(notificationService, times(1)).sendNotification(eq("u1@test.com"), anyString(), anyString());

        // El email recibe la lista con AMBAS búsquedas.
        ArgumentCaptor<List<String>> listCaptor = ArgumentCaptor.forClass(List.class);
        verify(emailTemplateService)
                .buildObjectMatchFoundEmail(any(), any(), listCaptor.capture(), any());
        assertThat(listCaptor.getValue()).containsExactlyInAnyOrder("mochila azul", "cartera negra");

        // La notificación in-app también las lista a ambas.
        ArgumentCaptor<String> descCaptor = ArgumentCaptor.forClass(String.class);
        verify(inAppNotificationService)
                .createNotification(any(), anyString(), descCaptor.capture(), eq("MATCH_FOUND"),
                        isNull(), eq("fo-1"), any(Double.class));
        assertThat(descCaptor.getValue()).contains("mochila azul").contains("cartera negra");
    }

    @Test
    void notification_carriesFoundObjectUuidAndBestScore() {
        // EU-345: sin estos dos datos el aviso no puede llevar a la coincidencia. El usuario tiene
        // DOS búsquedas que coinciden con el mismo objeto, cada una con su puntaje: se guarda el mayor.
        FoundObject found = foundObjectAt(CORDOBA);
        LostObject fuerte = savedSearch("u1@test.com", "mochila azul", 1.0f, CORDOBA);
        LostObject floja = savedSearch("u1@test.com", "mochila", 0.95f, CORDOBA);
        when(lostObjectRepository.queryDual(any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(floja, fuerte));
        when(userRepository.findByUsername("u1@test.com"))
                .thenReturn(Optional.of(user("u1@test.com", Role.USER)));

        service.notifyMatchingSavedSearches(found);

        ArgumentCaptor<String> uuidCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Double> scoreCaptor = ArgumentCaptor.forClass(Double.class);
        verify(inAppNotificationService).createNotification(any(), any(), any(), eq("MATCH_FOUND"),
                isNull(), uuidCaptor.capture(), scoreCaptor.capture());

        assertThat(uuidCaptor.getValue()).isEqualTo("fo-1");
        // Se compara contra el puntaje que el propio servicio dejó seteado en cada búsqueda, para no
        // atar el test a la escala concreta de displayScore.
        double esperado = Math.max(fuerte.getScore(), floja.getScore());
        assertThat(scoreCaptor.getValue()).isEqualTo(esperado);
        assertThat(fuerte.getScore()).isGreaterThan(floja.getScore());
    }

    @Test
    void nonUserRecipient_isSkipped() {
        FoundObject found = foundObjectAt(CORDOBA);
        LostObject search = savedSearch("owner@org.com", "mochila", 1.0f, CORDOBA);
        when(lostObjectRepository.queryDual(any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(List.of(search));
        when(userRepository.findByUsername("owner@org.com"))
                .thenReturn(Optional.of(user("owner@org.com", Role.ORGANIZATION_OWNER)));

        service.notifyMatchingSavedSearches(found);

        verify(notificationService, never()).sendNotification(any(), any(), any());
        verify(inAppNotificationService, never()).createNotification(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void noCandidates_doesNotNotify() {
        FoundObject found = foundObjectAt(CORDOBA);
        when(lostObjectRepository.queryDual(any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(List.of());

        service.notifyMatchingSavedSearches(found);

        verify(notificationService, never()).sendNotification(any(), any(), any());
        verify(inAppNotificationService, never()).createNotification(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void closedSearch_isNotNotified() {
        FoundObject found = foundObjectAt(CORDOBA);
        LostObject search = savedSearch("u1@test.com", "mochila azul", 1.0f, CORDOBA);
        search.setStatus(LostObjectStatus.CLOSED); // ya cerrada => no debe disparar aviso
        when(lostObjectRepository.queryDual(any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(List.of(search));

        service.notifyMatchingSavedSearches(found);

        verify(notificationService, never()).sendNotification(any(), any(), any());
        verify(inAppNotificationService, never()).createNotification(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void differentCategory_isNotNotified() {
        // El objeto encontrado es OTROS; una búsqueda de otra categoría (BILLETERA) NUNCA se cruza,
        // aunque su parecido sea perfecto (filtro DURO por categoría, decisión 5).
        FoundObject found = foundObjectAt(CORDOBA);
        LostObject search = savedSearch("u1@test.com", "billetera", 1.0f, CORDOBA, ObjectCategory.BILLETERA);
        when(lostObjectRepository.queryDual(any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(search));

        service.notifyMatchingSavedSearches(found);

        verify(notificationService, never()).sendNotification(any(), any(), any());
        verify(inAppNotificationService, never()).createNotification(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void searchWithoutCategory_isStillConsidered() {
        // EU-326: una búsqueda guardada sin foto no tiene categoría. "Desconocida" no es "distinta":
        // si la descartáramos quedaría invisible para siempre y sin ninguna señal. Se la deja competir
        // y decide el umbral, igual que a cualquier otra.
        FoundObject found = foundObjectAt(CORDOBA);
        LostObject search = savedSearch("u1@test.com", "billetera", 1.0f, CORDOBA);
        search.setCategory(null);
        search.setImageCertainty(null); // sin foto no hay parecido visual: sólo aporta el texto
        when(lostObjectRepository.queryDual(any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(search));
        when(userRepository.findByUsername("u1@test.com"))
                .thenReturn(Optional.of(user("u1@test.com", Role.USER)));

        service.notifyMatchingSavedSearches(found);

        verify(notificationService).sendNotification(eq("u1@test.com"), any(), any());
        verify(inAppNotificationService).createNotification(any(), any(), any(), eq("MATCH_FOUND"), any(), eq("fo-1"), any());
    }

    @Test
    void close_byOwner_closesWithRecoveredAnswer() {
        LostObject search = savedSearch("u1@test.com", "mochila azul", 1.0f, CORDOBA);
        search.setStatus(LostObjectStatus.ACTIVE);
        when(lostObjectRepository.getByUuid(search.getUuid())).thenReturn(search);

        service.closeLostObject("u1@test.com", search.getUuid(), true);

        // El "¿lo recuperaste?" se guarda en la propia búsqueda; no se crea ningún SearchFeedback.
        verify(lostObjectRepository).close(eq(search.getUuid()), any(LocalDateTime.class), eq(true));
    }

    @Test
    void close_byNonOwner_throwsNotFoundAndDoesNotClose() {
        LostObject search = savedSearch("owner@test.com", "mochila", 1.0f, CORDOBA);
        when(lostObjectRepository.getByUuid(search.getUuid())).thenReturn(search);

        assertThatThrownBy(() -> service.closeLostObject("intruso@test.com", search.getUuid(), true))
                .isInstanceOf(NotFoundException.class);

        verify(lostObjectRepository, never()).close(any(), any(), anyBoolean());
    }

    @Test
    void close_alreadyClosed_throwsBadRequest() {
        LostObject search = savedSearch("u1@test.com", "mochila", 1.0f, CORDOBA);
        search.setStatus(LostObjectStatus.CLOSED);
        when(lostObjectRepository.getByUuid(search.getUuid())).thenReturn(search);

        assertThatThrownBy(() -> service.closeLostObject("u1@test.com", search.getUuid(), false))
                .isInstanceOf(BadRequestException.class);

        verify(lostObjectRepository, never()).close(any(), any(), anyBoolean());
    }

    @Test
    void close_nonexistent_throwsNotFound() {
        when(lostObjectRepository.getByUuid("missing")).thenReturn(null);

        assertThatThrownBy(() -> service.closeLostObject("u1@test.com", "missing", true))
                .isInstanceOf(NotFoundException.class);

        verify(lostObjectRepository, never()).close(any(), any(), anyBoolean());
    }

    // ---- reportLostObject (EU-324-C): guardar búsqueda = foto + texto, CLIP + categoría IA + S3 al guardar ----

    @Test
    void reportLostObject_persistsBothVectorsAndCategory_andUploadsPhoto() {
        MockMultipartFile photo = new MockMultipartFile("file", new byte[]{1, 2, 3});
        ReportLostObjectCommand command = ReportLostObjectCommand.builder()
                .image(photo)
                .description("billetera de cuero marrón")
                .username("u1@test.com")
                .geoCoordinates(CORDOBA)
                .organizationId("1")
                .lostDate(LocalDateTime.now().minusDays(1))
                .build();
        when(imageEmbeddingService.getImageVectorRepresentation(any())).thenReturn(List.of(0.4f, 0.5f));
        when(imageClassificationService.classify(any())).thenReturn(ObjectCategory.BILLETERA);
        when(embeddingService.getTextVectorRepresentation(anyString())).thenReturn(List.of(0.1f, 0.2f));

        service.reportLostObject(command);

        ArgumentCaptor<LostObject> captor = ArgumentCaptor.forClass(LostObject.class);
        verify(lostObjectRepository).add(captor.capture());
        LostObject saved = captor.getValue();
        assertThat(saved.getImageEmbedding()).containsExactly(0.4f, 0.5f);
        assertThat(saved.getTextEmbedding()).containsExactly(0.1f, 0.2f);
        assertThat(saved.getCategory()).isEqualTo(ObjectCategory.BILLETERA.name());
        // La foto se sube a S3 sólo al guardar, con key = uuid de la búsqueda.
        verify(objectStorage).putObject(eq(new byte[]{1, 2, 3}), eq(saved.getUuid()));
    }

    @Test
    void reportLostObject_normalizesDescriptionBeforeEmbedding() {
        // EU-142: el texto que alimenta el vector se normaliza (minúsculas, tildes, formato de
        // identificadores) para que el mismo dato escrito distinto coincida. La descripción SE PERSISTE
        // tal cual la escribió el usuario; sólo lo que va al vector queda "parejo".
        MockMultipartFile photo = new MockMultipartFile("file", new byte[]{1, 2, 3});
        ReportLostObjectCommand command = ReportLostObjectCommand.builder()
                .image(photo)
                .description("Billétera con DNI 40.682.351")
                .username("u1@test.com")
                .geoCoordinates(CORDOBA)
                .organizationId("1")
                .lostDate(LocalDateTime.now().minusDays(1))
                .build();
        when(imageEmbeddingService.getImageVectorRepresentation(any())).thenReturn(List.of(0.4f, 0.5f));
        when(imageClassificationService.classify(any())).thenReturn(ObjectCategory.BILLETERA);
        when(embeddingService.getTextVectorRepresentation(anyString())).thenReturn(List.of(0.1f, 0.2f));

        service.reportLostObject(command);

        ArgumentCaptor<String> textToEmbed = ArgumentCaptor.forClass(String.class);
        verify(embeddingService).getTextVectorRepresentation(textToEmbed.capture());
        assertThat(textToEmbed.getValue()).isEqualTo("billetera con dni 40682351");

        // Lo persistido conserva el texto original del usuario (tildes, mayúsculas y puntos del DNI).
        ArgumentCaptor<LostObject> saved = ArgumentCaptor.forClass(LostObject.class);
        verify(lostObjectRepository).add(saved.capture());
        assertThat(saved.getValue().getDescription()).isEqualTo("Billétera con DNI 40.682.351");
    }

    @Test
    void reportLostObject_withoutPhoto_savesTextOnlySearch() {
        // EU-326: la foto pasó a ser OPCIONAL. Sin foto la búsqueda se guarda igual, pero queda más
        // débil: sólo con el vector textual, sin categoría dura y sin nada subido a S3.
        ReportLostObjectCommand command = ReportLostObjectCommand.builder()
                .image(null)
                .description("billetera de cuero marrón")
                .username("u1@test.com")
                .geoCoordinates(CORDOBA)
                .organizationId("1")
                .lostDate(LocalDateTime.now().minusDays(1))
                .build();
        when(embeddingService.getTextVectorRepresentation(anyString())).thenReturn(List.of(0.1f, 0.2f));

        service.reportLostObject(command);

        ArgumentCaptor<LostObject> captor = ArgumentCaptor.forClass(LostObject.class);
        verify(lostObjectRepository).add(captor.capture());
        LostObject saved = captor.getValue();
        assertThat(saved.getTextEmbedding()).containsExactly(0.1f, 0.2f);
        assertThat(saved.getImageEmbedding()).isNull();
        assertThat(saved.getCategory()).isNull();
        assertThat(saved.getHasImage()).isFalse();
        verify(imageEmbeddingService, never()).getImageVectorRepresentation(any());
        verify(imageClassificationService, never()).classify(any());
        verify(objectStorage, never()).putObject(any(), anyString());
    }

    @Test
    void getMyLostObjects_exposesPhotoUrlOnlyWhenSavedWithPhoto() {
        // EU-326: la foto vive en S3 con key = uuid. Una búsqueda guardada SIN foto no tiene nada que
        // mostrar, y pedir la URL igual daría un enlace roto en el detalle.
        LostObject conFoto = savedSearch("u1@test.com", "billetera marron", 1.0f, CORDOBA);
        conFoto.setHasImage(true);
        LostObject sinFoto = savedSearch("u1@test.com", "paraguas negro", 1.0f, CORDOBA);
        sinFoto.setHasImage(false);
        when(lostObjectRepository.query(any(), eq("u1@test.com"), any(), any(), any()))
                .thenReturn(List.of(conFoto, sinFoto));
        when(objectStorage.getObjectUrl(conFoto.getUuid())).thenReturn("https://s3/foto.jpg");

        List<LostObjectResponseDto> result = service.getMyLostObjects("u1@test.com");

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getImageUrl()).isEqualTo("https://s3/foto.jpg");
        assertThat(result.get(1).getImageUrl()).isNull();
        verify(objectStorage, never()).getObjectUrl(sinFoto.getUuid());
    }

    @Test
    void getMyLostObjects_resolvesOrganizationNameAndExposesCategory() {
        // El id de la organización no le dice nada al usuario, y la categoría tiene que verse porque
        // el filtro es DURO: si se infirió mal, el objeto no aparece nunca y sin ninguna señal.
        LostObject conOrg = savedSearch("u1@test.com", "billetera marron", 1.0f, CORDOBA,
                ObjectCategory.BILLETERA);
        conOrg.setOrganizationId("1");
        LostObject sinOrg = savedSearch("u1@test.com", "paraguas negro", 1.0f, CORDOBA);
        sinOrg.setOrganizationId(null);
        when(lostObjectRepository.query(any(), eq("u1@test.com"), any(), any(), any()))
                .thenReturn(List.of(conOrg, sinOrg));

        List<LostObjectResponseDto> result = service.getMyLostObjects("u1@test.com");

        assertThat(result.get(0).getOrganizationName()).isEqualTo("Org Test");
        assertThat(result.get(0).getCategory()).isEqualTo(ObjectCategory.BILLETERA.name());
        // Sin organización (se perdió en la vía pública) no hay nombre que mostrar.
        assertThat(result.get(1).getOrganizationName()).isNull();
    }

    @Test
    void getMyLostObjects_unknownOrganization_doesNotBreakTheList() {
        // Una organización que ya no está es un dato de presentación: no puede tirar abajo el
        // listado entero de búsquedas del usuario.
        LostObject lo = savedSearch("u1@test.com", "billetera marron", 1.0f, CORDOBA);
        lo.setOrganizationId("999");
        when(lostObjectRepository.query(any(), eq("u1@test.com"), any(), any(), any()))
                .thenReturn(List.of(lo));
        when(organizationRepository.findById(999L)).thenReturn(Optional.empty());

        List<LostObjectResponseDto> result = service.getMyLostObjects("u1@test.com");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getOrganizationName()).isNull();
        assertThat(result.get(0).getOrganizationId()).isEqualTo("999");
    }

    @Test
    void reportLostObject_withoutDescription_throwsBadRequest() {
        MockMultipartFile photo = new MockMultipartFile("file", new byte[]{1, 2, 3});
        ReportLostObjectCommand command = ReportLostObjectCommand.builder()
                .image(photo)
                .description("   ")
                .username("u1@test.com")
                .build();

        assertThatThrownBy(() -> service.reportLostObject(command))
                .isInstanceOf(BadRequestException.class);

        verify(lostObjectRepository, never()).add(any());
        verify(objectStorage, never()).putObject(any(), anyString());
    }

    // ---- helpers ----

    private FoundObject foundObjectAt(GeoCoordinates coordinates) {
        return FoundObject.builder()
                .uuid("fo-1")
                .title("Objeto encontrado")
                .imageEmbedding(List.of(0.4f, 0.5f, 0.6f))
                .textEmbedding(List.of(0.1f, 0.2f, 0.3f))
                // EU-324: la búsqueda inversa filtra por categoría dura y puntúa con α/β de esa categoría.
                .category(ObjectCategory.OTROS.name())
                .coordinates(coordinates)
                .foundDate(LocalDateTime.now())
                .organizationId("1")
                .build();
    }

    /**
     * Búsqueda guardada candidata. {@code certainty} alimenta AMBAS modalidades (imagen y texto) para
     * el {@code combinedScore}; misma categoría que el objeto encontrado (OTROS) salvo que se indique otra.
     */
    private LostObject savedSearch(String username, String description, Float certainty, GeoCoordinates coordinates) {
        return savedSearch(username, description, certainty, coordinates, ObjectCategory.OTROS);
    }

    private LostObject savedSearch(String username, String description, Float certainty,
                                   GeoCoordinates coordinates, ObjectCategory category) {
        return LostObject.builder()
                .uuid(UUID.randomUUID().toString())
                .username(username)
                .description(description)
                .imageCertainty(certainty)
                .textCertainty(certainty)
                .category(category.name())
                .coordinates(coordinates)
                .lostDate(LocalDateTime.now().minusDays(1))
                .build();
    }

    private UserEurekapp user(String username, Role role) {
        return UserEurekapp.builder()
                .id(1L).username(username).firstName("Nombre").lastName("Apellido").role(role)
                .build();
    }
}
