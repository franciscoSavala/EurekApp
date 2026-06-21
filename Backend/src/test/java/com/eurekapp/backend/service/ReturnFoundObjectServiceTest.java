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
}
