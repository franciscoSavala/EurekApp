package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.response.FraudDetectionConfigDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.ForbiddenException;
import com.eurekapp.backend.model.FraudDetectionConfig;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IFraudDetectionConfigRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FraudDetectionConfigServiceTest {

    @Mock
    IFraudDetectionConfigRepository configRepository;

    FraudDetectionConfigService service;

    @BeforeEach
    void setUp() {
        service = new FraudDetectionConfigService(configRepository);
    }

    private UserEurekapp adminUser() {
        return UserEurekapp.builder().id(1L).role(Role.ADMIN).build();
    }

    private UserEurekapp nonAdminUser(Role role) {
        return UserEurekapp.builder().id(2L).role(role).build();
    }

    // Sin config en BD: getConfig crea y persiste el default (N=5, T=1)
    @Test
    void getConfig_whenNoConfigExists_createsAndReturnsDefault() {
        when(configRepository.findById(FraudDetectionConfigService.CONFIG_ID)).thenReturn(Optional.empty());
        when(configRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        FraudDetectionConfigDto result = service.getConfig(adminUser());

        assertThat(result.getFraudThreshold()).isEqualTo(FraudDetectionConfigService.DEFAULT_THRESHOLD);
        assertThat(result.getFraudWindowDays()).isEqualTo(FraudDetectionConfigService.DEFAULT_WINDOW_DAYS);
        assertThat(result.getBlockDurationDays()).isEqualTo(FraudDetectionConfigService.DEFAULT_BLOCK_DURATION_DAYS);
        verify(configRepository).save(any(FraudDetectionConfig.class));
    }

    // Con config existente: getConfig la devuelve sin crear una nueva
    @Test
    void getConfig_whenConfigExists_returnsExisting() {
        FraudDetectionConfig existing = FraudDetectionConfig.builder()
                .id(1L).fraudThreshold(10).fraudWindowDays(3).build();
        when(configRepository.findById(FraudDetectionConfigService.CONFIG_ID)).thenReturn(Optional.of(existing));

        FraudDetectionConfigDto result = service.getConfig(adminUser());

        assertThat(result.getFraudThreshold()).isEqualTo(10);
        assertThat(result.getFraudWindowDays()).isEqualTo(3);
        verify(configRepository, never()).save(any());
    }

    // ADMIN puede actualizar N, T y la duración del bloqueo; el resultado refleja los nuevos valores
    @Test
    void updateConfig_asAdmin_updatesAndReturnsNewValues() {
        FraudDetectionConfig existing = FraudDetectionConfig.builder()
                .id(1L).fraudThreshold(5).fraudWindowDays(1).blockDurationDays(7).build();
        when(configRepository.findById(FraudDetectionConfigService.CONFIG_ID)).thenReturn(Optional.of(existing));
        when(configRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        FraudDetectionConfigDto result = service.updateConfig(adminUser(), 8, 2, 14);

        assertThat(result.getFraudThreshold()).isEqualTo(8);
        assertThat(result.getFraudWindowDays()).isEqualTo(2);
        assertThat(result.getBlockDurationDays()).isEqualTo(14);
        verify(configRepository).save(existing);
    }

    // Un rol no-ADMIN (ej. ORGANIZATION_OWNER) recibe ForbiddenException en getConfig
    @Test
    void getConfig_asNonAdmin_throwsForbidden() {
        assertThatThrownBy(() -> service.getConfig(nonAdminUser(Role.ORGANIZATION_OWNER)))
                .isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(configRepository);
    }

    // Un rol no-ADMIN recibe ForbiddenException en updateConfig
    @Test
    void updateConfig_asNonAdmin_throwsForbidden() {
        assertThatThrownBy(() -> service.updateConfig(nonAdminUser(Role.ENCARGADO), 5, 1, 7))
                .isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(configRepository);
    }

    // N=0 es inválido: updateConfig lanza BadRequestException antes de tocar el repo
    @Test
    void updateConfig_withZeroThreshold_throwsBadRequest() {
        assertThatThrownBy(() -> service.updateConfig(adminUser(), 0, 1, 7))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(configRepository);
    }

    // T=0 es inválido: updateConfig lanza BadRequestException antes de tocar el repo
    @Test
    void updateConfig_withZeroWindowDays_throwsBadRequest() {
        assertThatThrownBy(() -> service.updateConfig(adminUser(), 5, 0, 7))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(configRepository);
    }

    // Duración de bloqueo = 0 es inválido: updateConfig lanza BadRequestException antes de tocar el repo
    @Test
    void updateConfig_withZeroBlockDuration_throwsBadRequest() {
        assertThatThrownBy(() -> service.updateConfig(adminUser(), 5, 1, 0))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(configRepository);
    }

    // loadOrCreateDefault sin config en BD: crea el singleton con id=1 y valores default
    @Test
    void loadOrCreateDefault_whenEmpty_persistsSingleton() {
        when(configRepository.findById(FraudDetectionConfigService.CONFIG_ID)).thenReturn(Optional.empty());
        when(configRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        FraudDetectionConfig config = service.loadOrCreateDefault();

        assertThat(config.getId()).isEqualTo(FraudDetectionConfigService.CONFIG_ID);
        assertThat(config.getFraudThreshold()).isEqualTo(FraudDetectionConfigService.DEFAULT_THRESHOLD);
        assertThat(config.getFraudWindowDays()).isEqualTo(FraudDetectionConfigService.DEFAULT_WINDOW_DAYS);
        assertThat(config.getBlockDurationDays()).isEqualTo(FraudDetectionConfigService.DEFAULT_BLOCK_DURATION_DAYS);
    }
}
