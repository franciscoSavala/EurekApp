package com.eurekapp.backend.service;

import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.repository.*;
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

import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ReturnFoundObjectServiceTest {

    @Mock IOrganizationRepository organizationRepository;
    @Mock IUserRepository userRepository;
    @Mock IReturnFoundObjectRepository returnFoundObjectRepository;
    @Mock FoundObjectRepository foundObjectRepository;
    @Mock ObjectStorage s3Service;
    @Mock ExecutorService executorService;
    @Mock NotificationService notificationService;
    @Mock IRewardExclusionRepository rewardExclusionRepository;
    @Mock InAppNotificationService inAppNotificationService;
    @Mock EmailTemplateService emailTemplateService;
    @Mock FraudDetectionService fraudDetectionService;
    @Mock FraudBlockService fraudBlockService;

    ReturnFoundObjectService service;

    @BeforeEach
    void setUp() {
        service = new ReturnFoundObjectService(
                organizationRepository, userRepository, returnFoundObjectRepository,
                foundObjectRepository, s3Service, executorService, notificationService,
                rewardExclusionRepository,
                inAppNotificationService, emailTemplateService, fraudDetectionService,
                fraudBlockService);
    }

    @Test
    @SuppressWarnings("unchecked")
    void returnedByEmployee_is_set_to_caller() throws Exception {
        Organization org = Organization.builder().id(1L).name("TestOrg").build();

        UserEurekapp caller = UserEurekapp.builder()
                .id(10L)
                .username("employee@test.com")
                .firstName("Emp")
                .lastName("Loyee")
                .role(Role.ORGANIZATION_EMPLOYEE)
                .organization(org)
                .build();

        FoundObject fo = FoundObject.builder()
                .uuid("uuid-123")
                .organizationId("1")
                .wasReturned(false)
                .objectFinderUser(null)
                .build();

        ReturnFoundObjectCommand command = ReturnFoundObjectCommand.builder()
                .firstName("Marina")
                .lastName("Quiroga")
                .DNI("12345678")
                .phoneNumber("3511234567")
                .foundObjectUUID("uuid-123")
                .organizationId(1L)
                .username(null)
                .image(new MockMultipartFile("img", new byte[]{1, 2, 3}))
                .build();

        when(organizationRepository.existsById(1L)).thenReturn(true);
        when(foundObjectRepository.getByUuid("uuid-123")).thenReturn(fo);
        when(rewardExclusionRepository.existsByFoundObjectUUID("uuid-123")).thenReturn(false);

        Future<Void> voidFuture = mock(Future.class);
        when(voidFuture.get()).thenReturn(null);
        Future<ReturnFoundObject> saveFuture = mock(Future.class);

        ArgumentCaptor<ReturnFoundObject> savedCaptor = ArgumentCaptor.forClass(ReturnFoundObject.class);

        // Stub para submit(Callable): ejecuta sincrónicamente y devuelve el resultado.
        doAnswer(inv -> {
            java.util.concurrent.Callable<?> callable = inv.getArgument(0);
            Object result = callable.call();
            Future<?> f = mock(Future.class);
            doReturn(result).when(f).get();
            return f;
        }).when(executorService).submit(any(java.util.concurrent.Callable.class));

        // Stub para submit(Runnable): ejecuta sincrónicamente y devuelve Future<null>.
        doAnswer(inv -> {
            Runnable r = inv.getArgument(0);
            r.run();
            Future<?> f = mock(Future.class);
            doReturn(null).when(f).get();
            return f;
        }).when(executorService).submit(any(Runnable.class));

        when(returnFoundObjectRepository.save(any(ReturnFoundObject.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        service.returnFoundObject(command, caller);

        verify(returnFoundObjectRepository, atLeastOnce()).save(savedCaptor.capture());
        ReturnFoundObject persisted = savedCaptor.getAllValues().get(0);
        assertThat(persisted.getReturnedByEmployee()).isEqualTo(caller);
        assertThat(persisted.getDNI()).isEqualTo("12345678");
    }

    @Test
    @SuppressWarnings("unchecked")
    void detectFraud_isInvoked_withSavedReturn() throws Exception {
        Organization org = Organization.builder().id(1L).name("TestOrg").build();

        UserEurekapp caller = UserEurekapp.builder()
                .id(10L)
                .username("employee@test.com")
                .firstName("Emp")
                .lastName("Loyee")
                .role(Role.ORGANIZATION_EMPLOYEE)
                .organization(org)
                .build();

        FoundObject fo = FoundObject.builder()
                .uuid("uuid-123")
                .organizationId("1")
                .wasReturned(false)
                .objectFinderUser(null)
                .build();

        ReturnFoundObjectCommand command = ReturnFoundObjectCommand.builder()
                .firstName("Marina")
                .lastName("Quiroga")
                .DNI("12345678")
                .phoneNumber("3511234567")
                .foundObjectUUID("uuid-123")
                .organizationId(1L)
                .username(null)
                .image(new MockMultipartFile("img", new byte[]{1, 2, 3}))
                .build();

        when(organizationRepository.existsById(1L)).thenReturn(true);
        when(foundObjectRepository.getByUuid("uuid-123")).thenReturn(fo);
        when(rewardExclusionRepository.existsByFoundObjectUUID("uuid-123")).thenReturn(false);

        // Stub para submit(Callable): ejecuta sincrónicamente y devuelve el resultado.
        doAnswer(inv -> {
            java.util.concurrent.Callable<?> callable = inv.getArgument(0);
            Object result = callable.call();
            Future<?> f = mock(Future.class);
            doReturn(result).when(f).get();
            return f;
        }).when(executorService).submit(any(java.util.concurrent.Callable.class));

        // Stub para submit(Runnable): ejecuta sincrónicamente y devuelve Future<null>.
        doAnswer(inv -> {
            Runnable r = inv.getArgument(0);
            r.run();
            Future<?> f = mock(Future.class);
            doReturn(null).when(f).get();
            return f;
        }).when(executorService).submit(any(Runnable.class));

        when(returnFoundObjectRepository.save(any(ReturnFoundObject.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        service.returnFoundObject(command, caller);

        ArgumentCaptor<ReturnFoundObject> detectedCaptor = ArgumentCaptor.forClass(ReturnFoundObject.class);
        verify(fraudDetectionService).detectFraudForReturn(detectedCaptor.capture());
        ReturnFoundObject detected = detectedCaptor.getValue();
        assertThat(detected.getDNI()).isEqualTo("12345678");
        assertThat(detected.getReturnedByEmployee()).isEqualTo(caller);
    }

    @Test
    @SuppressWarnings("unchecked")
    void returnFails_whenFraudControlThrows() throws Exception {
        Organization org = Organization.builder().id(1L).name("TestOrg").build();

        UserEurekapp caller = UserEurekapp.builder()
                .id(10L)
                .username("employee@test.com")
                .firstName("Emp")
                .lastName("Loyee")
                .role(Role.ORGANIZATION_EMPLOYEE)
                .organization(org)
                .build();

        FoundObject fo = FoundObject.builder()
                .uuid("uuid-123")
                .organizationId("1")
                .wasReturned(false)
                .objectFinderUser(null)
                .build();

        ReturnFoundObjectCommand command = ReturnFoundObjectCommand.builder()
                .firstName("Marina")
                .lastName("Quiroga")
                .DNI("12345678")
                .phoneNumber("3511234567")
                .foundObjectUUID("uuid-123")
                .organizationId(1L)
                .username(null)
                .image(new MockMultipartFile("img", new byte[]{1, 2, 3}))
                .build();

        when(organizationRepository.existsById(1L)).thenReturn(true);
        when(foundObjectRepository.getByUuid("uuid-123")).thenReturn(fo);
        when(rewardExclusionRepository.existsByFoundObjectUUID("uuid-123")).thenReturn(false);

        doAnswer(inv -> {
            java.util.concurrent.Callable<?> callable = inv.getArgument(0);
            Object result = callable.call();
            Future<?> f = mock(Future.class);
            doReturn(result).when(f).get();
            return f;
        }).when(executorService).submit(any(java.util.concurrent.Callable.class));

        doAnswer(inv -> {
            Runnable r = inv.getArgument(0);
            r.run();
            Future<?> f = mock(Future.class);
            doReturn(null).when(f).get();
            return f;
        }).when(executorService).submit(any(Runnable.class));

        when(returnFoundObjectRepository.save(any(ReturnFoundObject.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // El control de fraude es obligatorio: si falla, la devolución no se completa.
        doThrow(new RuntimeException("fraud check failed"))
                .when(fraudDetectionService).detectFraudForReturn(any(ReturnFoundObject.class));

        assertThatThrownBy(() -> service.returnFoundObject(command, caller))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    @SuppressWarnings("unchecked")
    void returnFails_whenDniIsBlocked() throws Exception {
        Organization org = Organization.builder().id(1L).name("TestOrg").build();

        UserEurekapp caller = UserEurekapp.builder()
                .id(10L).username("employee@test.com").firstName("Emp").lastName("Loyee")
                .role(Role.ORGANIZATION_EMPLOYEE).organization(org).build();

        FoundObject fo = FoundObject.builder()
                .uuid("uuid-123").organizationId("1").wasReturned(false).objectFinderUser(null).build();

        ReturnFoundObjectCommand command = ReturnFoundObjectCommand.builder()
                .firstName("Marina")
                .lastName("Quiroga")
                .DNI("12345678").phoneNumber("3511234567").foundObjectUUID("uuid-123")
                .organizationId(1L).username(null)
                .image(new MockMultipartFile("img", new byte[]{1, 2, 3})).build();

        when(organizationRepository.existsById(1L)).thenReturn(true);
        when(foundObjectRepository.getByUuid("uuid-123")).thenReturn(fo);
        // El DNI ingresado está bloqueado por sospecha de fraude (con mensaje humano).
        when(fraudBlockService.describeActiveDniBlock(eq("12345678"), anyString()))
                .thenReturn(Optional.of("El DNI ingresado está temporalmente bloqueado."));

        assertThatThrownBy(() -> service.returnFoundObject(command, caller))
                .isInstanceOf(BadRequestException.class);

        // Se rechaza antes de persistir y antes de correr la detección.
        verify(returnFoundObjectRepository, never()).save(any());
        verify(fraudDetectionService, never()).detectFraudForReturn(any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void returnSucceeds_whenFinderBlocked_skipsRewardAndNotifies() throws Exception {
        Organization org = Organization.builder().id(1L).name("TestOrg").build();

        UserEurekapp caller = UserEurekapp.builder()
                .id(10L).username("employee@test.com").firstName("Emp").lastName("Loyee")
                .role(Role.ORGANIZATION_EMPLOYEE).organization(org).build();

        // El finder del objeto está bloqueado por sospecha de fraude.
        UserEurekapp finder = UserEurekapp.builder()
                .id(99L).username("finder@test.com").firstName("Fin").lastName("Der")
                .role(Role.USER).build();

        FoundObject fo = FoundObject.builder()
                .uuid("uuid-123").organizationId("1").title("Mochila azul")
                .wasReturned(false).objectFinderUser(finder).build();

        ReturnFoundObjectCommand command = ReturnFoundObjectCommand.builder()
                .firstName("Marina")
                .lastName("Quiroga")
                .DNI("12345678").phoneNumber("3511234567").foundObjectUUID("uuid-123")
                .organizationId(1L).username(null)
                .image(new MockMultipartFile("img", new byte[]{1, 2, 3})).build();

        when(organizationRepository.existsById(1L)).thenReturn(true);
        when(foundObjectRepository.getByUuid("uuid-123")).thenReturn(fo);
        when(userRepository.findById(99L)).thenReturn(Optional.of(finder));
        // El DNI/retirador NO están bloqueados; solo el finder (reward-skip, sigue usando isUserBlocked).
        when(fraudBlockService.describeActiveDniBlock(eq("12345678"), anyString()))
                .thenReturn(Optional.empty());
        when(fraudBlockService.isUserBlocked(99L)).thenReturn(true);

        doAnswer(inv -> {
            java.util.concurrent.Callable<?> callable = inv.getArgument(0);
            Object result = callable.call();
            Future<?> f = mock(Future.class);
            doReturn(result).when(f).get();
            return f;
        }).when(executorService).submit(any(java.util.concurrent.Callable.class));

        doAnswer(inv -> {
            Runnable r = inv.getArgument(0);
            r.run();
            Future<?> f = mock(Future.class);
            doReturn(null).when(f).get();
            return f;
        }).when(executorService).submit(any(Runnable.class));

        when(returnFoundObjectRepository.save(any(ReturnFoundObject.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // La devolución se completa (no lanza) aunque el finder esté bloqueado.
        service.returnFoundObject(command, caller);

        // Se le notifica que no recibió puntos por estar bloqueado...
        verify(inAppNotificationService).createNotification(
                eq(finder), anyString(), anyString(), eq("REWARD_BLOCKED"), isNull());
        // ...y NO se le otorga la recompensa habitual.
        verify(inAppNotificationService, never()).createNotification(
                any(), anyString(), anyString(), eq("REWARD_EARNED"), any());
        verify(userRepository, never()).save(finder);   // no se suma XP
    }

    // ─── EU-362: nombre y apellido de quien retira ───────────────────────────────────────────

    @Test
    @SuppressWarnings("unchecked")
    void nombreYApellido_sePersistenYVuelvenEnElDto() throws Exception {
        Organization org = Organization.builder().id(1L).name("TestOrg").build();

        UserEurekapp caller = UserEurekapp.builder()
                .id(10L).username("employee@test.com").firstName("Emp").lastName("Loyee")
                .role(Role.ORGANIZATION_EMPLOYEE).organization(org).build();

        FoundObject fo = FoundObject.builder()
                .uuid("uuid-123").organizationId("1").wasReturned(false).objectFinderUser(null).build();

        // Con espacios de sobra a propósito: el servicio los recorta antes de guardar.
        ReturnFoundObjectCommand command = ReturnFoundObjectCommand.builder()
                .firstName("  Marina  ")
                .lastName(" Quiroga ")
                .DNI("12345678").phoneNumber("3511234567").foundObjectUUID("uuid-123")
                .organizationId(1L).username(null)
                .image(new MockMultipartFile("img", new byte[]{1, 2, 3})).build();

        when(organizationRepository.existsById(1L)).thenReturn(true);
        when(foundObjectRepository.getByUuid("uuid-123")).thenReturn(fo);
        when(rewardExclusionRepository.existsByFoundObjectUUID("uuid-123")).thenReturn(false);

        doAnswer(inv -> {
            java.util.concurrent.Callable<?> callable = inv.getArgument(0);
            Object result = callable.call();
            Future<?> f = mock(Future.class);
            doReturn(result).when(f).get();
            return f;
        }).when(executorService).submit(any(java.util.concurrent.Callable.class));

        doAnswer(inv -> {
            Runnable r = inv.getArgument(0);
            r.run();
            Future<?> f = mock(Future.class);
            doReturn(null).when(f).get();
            return f;
        }).when(executorService).submit(any(Runnable.class));

        when(returnFoundObjectRepository.save(any(ReturnFoundObject.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        var dto = service.returnFoundObject(command, caller);

        ArgumentCaptor<ReturnFoundObject> savedCaptor = ArgumentCaptor.forClass(ReturnFoundObject.class);
        verify(returnFoundObjectRepository, atLeastOnce()).save(savedCaptor.capture());
        ReturnFoundObject persisted = savedCaptor.getAllValues().get(0);
        assertThat(persisted.getFirstName()).isEqualTo("Marina");
        assertThat(persisted.getLastName()).isEqualTo("Quiroga");

        assertThat(dto.getFirstName()).isEqualTo("Marina");
        assertThat(dto.getLastName()).isEqualTo("Quiroga");
    }

    /* EU-371: la devolucion asienta en que organizacion ocurrio. De ahi sale la organizacion a la
     * que se le atribuye la calificacion que la persona puede dejar despues de retirar; antes habia
     * que ir a buscarla a la base vectorial. */
    @Test
    void devolucion_registraLaOrganizacionDondeOcurrio() throws Exception {
        Organization org = Organization.builder().id(1L).name("TestOrg").build();

        UserEurekapp caller = UserEurekapp.builder()
                .id(10L).username("employee@test.com").firstName("Emp").lastName("Loyee")
                .role(Role.ORGANIZATION_EMPLOYEE).organization(org).build();

        FoundObject fo = FoundObject.builder()
                .uuid("uuid-123").organizationId("1").wasReturned(false).objectFinderUser(null).build();

        ReturnFoundObjectCommand command = ReturnFoundObjectCommand.builder()
                .firstName("Marina").lastName("Quiroga")
                .DNI("12345678").phoneNumber("3511234567").foundObjectUUID("uuid-123")
                .organizationId(1L).username(null)
                .image(new MockMultipartFile("img", new byte[]{1, 2, 3})).build();

        when(organizationRepository.existsById(1L)).thenReturn(true);
        when(foundObjectRepository.getByUuid("uuid-123")).thenReturn(fo);
        when(rewardExclusionRepository.existsByFoundObjectUUID("uuid-123")).thenReturn(false);

        doAnswer(inv -> {
            java.util.concurrent.Callable<?> callable = inv.getArgument(0);
            Object result = callable.call();
            Future<?> f = mock(Future.class);
            doReturn(result).when(f).get();
            return f;
        }).when(executorService).submit(any(java.util.concurrent.Callable.class));

        doAnswer(inv -> {
            Runnable r = inv.getArgument(0);
            r.run();
            Future<?> f = mock(Future.class);
            doReturn(null).when(f).get();
            return f;
        }).when(executorService).submit(any(Runnable.class));

        when(returnFoundObjectRepository.save(any(ReturnFoundObject.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        service.returnFoundObject(command, caller);

        ArgumentCaptor<ReturnFoundObject> savedCaptor = ArgumentCaptor.forClass(ReturnFoundObject.class);
        verify(returnFoundObjectRepository, atLeastOnce()).save(savedCaptor.capture());
        assertThat(savedCaptor.getAllValues().get(0).getOrganizationId()).isEqualTo(1L);
    }

    /* EU-373: la invitacion a calificar viaja en el correo que ya se le enviaba a quien recupero su
     * objeto, y lleva el identificador de SU devolucion. */
    @Test
    void devolucionDeUnUsuarioRegistrado_invitaACalificarConSuPropiaDevolucion() throws Exception {
        Organization org = Organization.builder().id(1L).name("TestOrg").build();

        UserEurekapp caller = UserEurekapp.builder()
                .id(10L).username("employee@test.com").firstName("Emp").lastName("Loyee")
                .role(Role.ORGANIZATION_EMPLOYEE).organization(org).build();

        UserEurekapp retirador = UserEurekapp.builder()
                .id(20L).username("julia@mail.com").firstName("Julia").lastName("Morales")
                .role(Role.USER).build();

        FoundObject fo = FoundObject.builder()
                .uuid("uuid-123").organizationId("1").wasReturned(false).objectFinderUser(null)
                .title("Billetera negra").build();

        ReturnFoundObjectCommand command = ReturnFoundObjectCommand.builder()
                .firstName("Julia").lastName("Morales")
                .DNI("12345678").phoneNumber("3511234567").foundObjectUUID("uuid-123")
                .organizationId(1L).username("julia@mail.com")
                .image(new MockMultipartFile("img", new byte[]{1, 2, 3})).build();

        when(organizationRepository.existsById(1L)).thenReturn(true);
        when(userRepository.existsByUsername("julia@mail.com")).thenReturn(true);
        when(userRepository.getByUsername("julia@mail.com")).thenReturn(retirador);
        when(foundObjectRepository.getByUuid("uuid-123")).thenReturn(fo);
        when(rewardExclusionRepository.existsByFoundObjectUUID("uuid-123")).thenReturn(false);

        doAnswer(inv -> {
            java.util.concurrent.Callable<?> callable = inv.getArgument(0);
            Object result = callable.call();
            Future<?> f = mock(Future.class);
            doReturn(result).when(f).get();
            return f;
        }).when(executorService).submit(any(java.util.concurrent.Callable.class));

        doAnswer(inv -> {
            Runnable r = inv.getArgument(0);
            r.run();
            Future<?> f = mock(Future.class);
            doReturn(null).when(f).get();
            return f;
        }).when(executorService).submit(any(Runnable.class));

        // La devolucion guardada recibe su id, que es lo que despues identifica la encuesta.
        when(returnFoundObjectRepository.save(any(ReturnFoundObject.class)))
                .thenAnswer(inv -> {
                    ReturnFoundObject saved = inv.getArgument(0);
                    saved.setId(77L);
                    return saved;
                });

        service.returnFoundObject(command, caller);

        verify(emailTemplateService).buildObjectRecoveredEmail(
                eq("Julia"), eq("Billetera negra"), eq("TestOrg"), anyString(), eq(77L));
        verify(notificationService).sendNotification(
                eq("julia@mail.com"), contains("Recuperaste tu objeto"), any());
    }

    /* Limite conocido: quien retira sin cuenta en EurekApp no recibe el correo, y por lo tanto
     * tampoco la invitacion. La devolucion tiene que completarse igual, sin error. */
    @Test
    void devolucionDeAlguienSinCuenta_seCompletaSinInvitacion() throws Exception {
        Organization org = Organization.builder().id(1L).name("TestOrg").build();

        UserEurekapp caller = UserEurekapp.builder()
                .id(10L).username("employee@test.com").firstName("Emp").lastName("Loyee")
                .role(Role.ORGANIZATION_EMPLOYEE).organization(org).build();

        FoundObject fo = FoundObject.builder()
                .uuid("uuid-123").organizationId("1").wasReturned(false).objectFinderUser(null)
                .title("Billetera negra").build();

        ReturnFoundObjectCommand command = ReturnFoundObjectCommand.builder()
                .firstName("Marina").lastName("Quiroga")
                .DNI("12345678").phoneNumber("3511234567").foundObjectUUID("uuid-123")
                .organizationId(1L).username(null)
                .image(new MockMultipartFile("img", new byte[]{1, 2, 3})).build();

        when(organizationRepository.existsById(1L)).thenReturn(true);
        when(foundObjectRepository.getByUuid("uuid-123")).thenReturn(fo);
        when(rewardExclusionRepository.existsByFoundObjectUUID("uuid-123")).thenReturn(false);

        doAnswer(inv -> {
            java.util.concurrent.Callable<?> callable = inv.getArgument(0);
            Object result = callable.call();
            Future<?> f = mock(Future.class);
            doReturn(result).when(f).get();
            return f;
        }).when(executorService).submit(any(java.util.concurrent.Callable.class));

        doAnswer(inv -> {
            Runnable r = inv.getArgument(0);
            r.run();
            Future<?> f = mock(Future.class);
            doReturn(null).when(f).get();
            return f;
        }).when(executorService).submit(any(Runnable.class));

        when(returnFoundObjectRepository.save(any(ReturnFoundObject.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        var dto = service.returnFoundObject(command, caller);

        assertThat(dto.getFirstName()).isEqualTo("Marina");
        verify(emailTemplateService, never()).buildObjectRecoveredEmail(
                any(), any(), any(), any(), any());
    }

    @Test
    void returnFails_whenFirstNameIsBlank() {
        Organization org = Organization.builder().id(1L).name("TestOrg").build();

        UserEurekapp caller = UserEurekapp.builder()
                .id(10L).username("employee@test.com")
                .role(Role.ORGANIZATION_EMPLOYEE).organization(org).build();

        ReturnFoundObjectCommand command = ReturnFoundObjectCommand.builder()
                .firstName("   ")
                .lastName("Quiroga")
                .DNI("12345678").phoneNumber("3511234567").foundObjectUUID("uuid-123")
                .organizationId(1L).username(null)
                .image(new MockMultipartFile("img", new byte[]{1, 2, 3})).build();

        assertThatThrownBy(() -> service.returnFoundObject(command, caller))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("nombre");

        // Se corta antes de tocar S3, la base y el control de fraude.
        verify(returnFoundObjectRepository, never()).save(any());
        verify(fraudDetectionService, never()).detectFraudForReturn(any());
    }

    @Test
    void returnFails_whenLastNameIsMissing() {
        Organization org = Organization.builder().id(1L).name("TestOrg").build();

        UserEurekapp caller = UserEurekapp.builder()
                .id(10L).username("employee@test.com")
                .role(Role.ORGANIZATION_EMPLOYEE).organization(org).build();

        ReturnFoundObjectCommand command = ReturnFoundObjectCommand.builder()
                .firstName("Marina")
                .DNI("12345678").phoneNumber("3511234567").foundObjectUUID("uuid-123")
                .organizationId(1L).username(null)
                .image(new MockMultipartFile("img", new byte[]{1, 2, 3})).build();

        assertThatThrownBy(() -> service.returnFoundObject(command, caller))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("apellido");

        verify(returnFoundObjectRepository, never()).save(any());
    }

    @Test
    void getReturnFoundObject_devuelveNombreYApellido() {
        Organization org = Organization.builder().id(1L).name("TestOrg").build();

        UserEurekapp consultant = UserEurekapp.builder()
                .id(10L).username("employee@test.com")
                .role(Role.ORGANIZATION_EMPLOYEE).organization(org).build();

        ReturnFoundObject rfo = new ReturnFoundObject();
        rfo.setId(5L);
        rfo.setFoundObjectUUID("uuid-123");
        rfo.setFirstName("Marina");
        rfo.setLastName("Quiroga");
        rfo.setDNI("12345678");
        rfo.setPhoneNumber("3511234567");
        rfo.setPersonPhotoUUID("person-photo-001");
        rfo.setDatetimeOfReturn(java.time.LocalDateTime.now());

        FoundObject fo = FoundObject.builder()
                .uuid("uuid-123").organizationId("1").wasReturned(true).objectFinderUser(null).build();

        when(returnFoundObjectRepository.findByFoundObjectUUID("uuid-123")).thenReturn(rfo);
        when(foundObjectRepository.getByUuid("uuid-123")).thenReturn(fo);
        when(rewardExclusionRepository.findByFoundObjectUUID("uuid-123")).thenReturn(Optional.empty());

        var dto = service.getReturnFoundObject(consultant, "uuid-123");

        assertThat(dto.getFirstName()).isEqualTo("Marina");
        assertThat(dto.getLastName()).isEqualTo("Quiroga");
        assertThat(dto.getDNI()).isEqualTo("12345678");
    }
}
