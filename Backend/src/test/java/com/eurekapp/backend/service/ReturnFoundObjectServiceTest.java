package com.eurekapp.backend.service;

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

    ReturnFoundObjectService service;

    @BeforeEach
    void setUp() {
        service = new ReturnFoundObjectService(
                organizationRepository, userRepository, returnFoundObjectRepository,
                foundObjectRepository, s3Service, executorService, notificationService,
                rewardExclusionRepository,
                inAppNotificationService, emailTemplateService);
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
}
