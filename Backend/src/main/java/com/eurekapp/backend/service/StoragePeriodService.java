package com.eurekapp.backend.service;

import com.eurekapp.backend.model.FoundObject;
import com.eurekapp.backend.model.OrganizationPolicy;
import com.eurekapp.backend.model.StorageStatus;
import com.eurekapp.backend.repository.IOrganizationPolicyRepository;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Aplica el plazo máximo de guarda de cada organización (EU-452).
 *
 * <p>Un objeto no devuelto está VENCIDO si ahora >= fecha de hallazgo + plazo (en días), y POR VENCER
 * si ya pasó el 80 % del plazo. Sin política, o con plazo vacío o menor o igual a cero, nunca vence.
 * Un objeto devuelto no tiene estado de guarda. Todo se calcula en el momento con el plazo vigente:
 * no se guarda nada.
 */
@Service
public class StoragePeriodService {

    private static final double EXPIRING_FRACTION = 0.8;

    private final IOrganizationPolicyRepository policyRepository;
    private final Clock clock;

    public StoragePeriodService(IOrganizationPolicyRepository policyRepository, Clock clock) {
        this.policyRepository = policyRepository;
        this.clock = clock;
    }

    public Integer getMaxStorageDays(String organizationId) {
        if (organizationId == null) { return null; }
        long orgId;
        try {
            orgId = Long.parseLong(organizationId.trim());
        } catch (NumberFormatException e) {
            return null;
        }
        return policyRepository.findByOrganization_Id(orgId)
                .map(OrganizationPolicy::getMaxStorageDays)
                .filter(days -> days > 0)
                .orElse(null);
    }

    public LocalDateTime getExpirationDate(FoundObject fo, Integer maxStorageDays) {
        if (fo == null || maxStorageDays == null || fo.getFoundDate() == null
                || Boolean.TRUE.equals(fo.getWasReturned())) {
            return null;
        }
        return fo.getFoundDate().plusDays(maxStorageDays);
    }

    public StorageStatus getStatus(FoundObject fo, Integer maxStorageDays) {
        LocalDateTime expiration = getExpirationDate(fo, maxStorageDays);
        if (expiration == null) { return null; }
        LocalDateTime now = LocalDateTime.now(clock);
        if (!now.isBefore(expiration)) { return StorageStatus.EXPIRED; }
        long expiringMinutes = Math.round(maxStorageDays * EXPIRING_FRACTION * 24 * 60);
        if (!now.isBefore(fo.getFoundDate().plus(Duration.ofMinutes(expiringMinutes)))) {
            return StorageStatus.EXPIRING;
        }
        return StorageStatus.IN_TERM;
    }

    public boolean isExpired(FoundObject fo) {
        if (fo == null) { return false; }
        return getStatus(fo, getMaxStorageDays(fo.getOrganizationId())) == StorageStatus.EXPIRED;
    }

    public List<FoundObject> excludeExpired(List<FoundObject> objects) {
        Map<String, Integer> daysByOrg = new HashMap<>();
        return objects.stream()
                .filter(fo -> {
                    String orgId = fo.getOrganizationId();
                    Integer days;
                    if (orgId == null) {
                        days = null;
                    } else if (daysByOrg.containsKey(orgId)) {
                        days = daysByOrg.get(orgId);
                    } else {
                        days = getMaxStorageDays(orgId);
                        daysByOrg.put(orgId, days);
                    }
                    return getStatus(fo, days) != StorageStatus.EXPIRED;
                })
                .toList();
    }
}
