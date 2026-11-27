package com.eurekapp.backend.service;

import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.model.OrganizationPolicy;
import com.eurekapp.backend.repository.IOrganizationPolicyRepository;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Aplica el plazo máximo, en días, para registrar una pérdida de una fecha anterior (EU-424).
 *
 * <p>Cada organización lo configura en sus políticas. Si no lo configuró, rige el valor por defecto de
 * {@value #DEFAULT_MAX_LOST_DATE_DAYS} días. Se compara por día calendario: una pérdida de hace exactamente
 * el plazo todavía se acepta. Una fecha futura se rechaza siempre, con o sin organización. Sin
 * organización no hay plazo que aplicar. El plazo se evalúa al buscar o guardar: modificarlo no invalida
 * las búsquedas ya guardadas.
 */
@Service
public class LostDateLimitService {

    public static final int DEFAULT_MAX_LOST_DATE_DAYS = 90;

    private final IOrganizationPolicyRepository policyRepository;
    private final Clock clock;

    public LostDateLimitService(IOrganizationPolicyRepository policyRepository, Clock clock) {
        this.policyRepository = policyRepository;
        this.clock = clock;
    }

    /** Plazo vigente de la organización; sin política, sin valor o con un valor no positivo rige el defecto. */
    public int getMaxLostDateDays(Long organizationId) {
        if (organizationId == null) { return DEFAULT_MAX_LOST_DATE_DAYS; }
        return policyRepository.findByOrganization_Id(organizationId)
                .map(OrganizationPolicy::getMaxLostDateDays)
                .filter(days -> days > 0)
                .orElse(DEFAULT_MAX_LOST_DATE_DAYS);
    }

    public void validateLostDate(String organizationId, LocalDateTime lostDate) {
        Long orgId = null;
        if (organizationId != null && !organizationId.isBlank()) {
            try {
                orgId = Long.valueOf(organizationId.trim());
            } catch (NumberFormatException e) {
                orgId = null;
            }
        }
        validateLostDate(orgId, lostDate);
    }

    public void validateLostDate(Long organizationId, LocalDateTime lostDate) {
        if (lostDate == null) { return; }
        LocalDate today = LocalDate.now(clock);
        LocalDate lost = lostDate.toLocalDate();
        if (lost.isAfter(today)) {
            throw new BadRequestException("lost_date_in_future",
                    "La fecha de pérdida no puede ser futura.");
        }
        if (organizationId == null) { return; }
        int maxDays = getMaxLostDateDays(organizationId);
        if (lost.isBefore(today.minusDays(maxDays))) {
            throw new BadRequestException("lost_date_too_old",
                    "Esta organización solo admite registrar pérdidas de hasta " + maxDays
                            + " días atrás. Elegí una fecha más reciente.");
        }
    }

    /** Valida el valor que el responsable quiere configurar: entero positivo, no vacío. */
    public static void validateConfiguredDays(Integer days) {
        if (days == null) {
            throw new BadRequestException("max_lost_date_days_required",
                    "Ingresá el plazo máximo en días para registrar pérdidas anteriores.");
        }
        if (days <= 0) {
            throw new BadRequestException("max_lost_date_days_invalid",
                    "El plazo debe ser un número entero mayor a cero.");
        }
    }
}
