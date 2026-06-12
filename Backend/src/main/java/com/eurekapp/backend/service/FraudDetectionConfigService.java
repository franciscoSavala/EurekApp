package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.response.FraudDetectionConfigDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.ForbiddenException;
import com.eurekapp.backend.model.FraudDetectionConfig;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IFraudDetectionConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@RequiredArgsConstructor
@Service
public class FraudDetectionConfigService {

    static final long CONFIG_ID = 1L;
    static final int DEFAULT_THRESHOLD = 5;
    static final int DEFAULT_WINDOW_DAYS = 1;

    private final IFraudDetectionConfigRepository configRepository;

    public FraudDetectionConfigDto getConfig(UserEurekapp admin) {
        requireAdmin(admin);
        FraudDetectionConfig config = loadOrCreateDefault();
        return toDto(config);
    }

    public FraudDetectionConfigDto updateConfig(UserEurekapp admin, int fraudThreshold, int fraudWindowDays) {
        requireAdmin(admin);
        if (fraudThreshold < 1) {
            throw new BadRequestException("invalid_fraud_threshold", "El umbral de fraude (N) debe ser al menos 1");
        }
        if (fraudWindowDays < 1) {
            throw new BadRequestException("invalid_fraud_window", "La ventana de fraude (T) debe ser al menos 1 día");
        }
        FraudDetectionConfig config = loadOrCreateDefault();
        config.setFraudThreshold(fraudThreshold);
        config.setFraudWindowDays(fraudWindowDays);
        configRepository.save(config);
        return toDto(config);
    }

    // Usado internamente por los servicios de detección y bloqueo (sin validación de rol)
    public FraudDetectionConfig loadOrCreateDefault() {
        return configRepository.findById(CONFIG_ID).orElseGet(() -> {
            FraudDetectionConfig defaults = FraudDetectionConfig.builder()
                    .id(CONFIG_ID)
                    .fraudThreshold(DEFAULT_THRESHOLD)
                    .fraudWindowDays(DEFAULT_WINDOW_DAYS)
                    .build();
            return configRepository.save(defaults);
        });
    }

    private void requireAdmin(UserEurekapp user) {
        if (user.getRole() != Role.ADMIN) {
            throw new ForbiddenException("forbidden", "Solo el administrador de EurekApp puede gestionar la configuración de fraude");
        }
    }

    private FraudDetectionConfigDto toDto(FraudDetectionConfig config) {
        return FraudDetectionConfigDto.builder()
                .fraudThreshold(config.getFraudThreshold())
                .fraudWindowDays(config.getFraudWindowDays())
                .build();
    }
}
