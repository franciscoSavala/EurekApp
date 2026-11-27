package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.response.*;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.ForbiddenException;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.repository.*;
import com.eurekapp.backend.util.OrganizationAddress;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

@AllArgsConstructor
@Service
public class OrganizationService {

    private IOrganizationRepository organizationRepository;
    private IOrganizationPolicyRepository policyRepository;
    private IOrganizationPolicyHistoryRepository historyRepository;
    private ObjectMapper objectMapper;

    public OrganizationListResponseDto getAllOrganizations() {
        List<PublicOrganizationDto> organizationDtos = organizationRepository.findAll().stream()
                .filter(Organization::isActive)
                .map(this::organizationToPublicDto)
                .toList();
        return new OrganizationListResponseDto(organizationDtos);
    }

    /**
     * EU-401: la organización como se le muestra a un usuario común, sin la información de contacto.
     *
     * <p>Ese campo se rellena solo con el correo del dueño al aprobar la organización, así que
     * mandarlo en la respuesta de una búsqueda repartía un correo personal que nadie ofreció como
     * contacto público. Va la dirección en su lugar: es lo que hace falta para ir a retirar.</p>
     *
     * <p>Es el único mapeo que queda: el que llevaba la información de contacto no tenía más
     * llamadores que éstos. La propia organización sigue recibiendo sus datos de contacto al iniciar
     * sesión y en su pantalla, que arman el DTO por su cuenta (AuthService, UserService).</p>
     */
    public PublicOrganizationDto organizationToPublicDto(Organization organization) {
        return PublicOrganizationDto.builder()
                .id(organization.getId())
                .name(organization.getName())
                .address(OrganizationAddress.format(organization))
                .build();
    }

    // ── Políticas ─────────────────────────────────────────────────────────────

    public OrganizationPolicyDto getPolicy(UserEurekapp user) {
        // EU-440: el responsable ve y edita las políticas; el resto del personal de la organización solo
        // las consulta (sin el historial de cambios) para ver qué se exige al devolver un objeto.
        boolean isOwner = user.getRole() == Role.ORGANIZATION_OWNER;
        boolean isStaff = user.getRole() == Role.ORGANIZATION_EMPLOYEE || user.getRole() == Role.ENCARGADO;
        if ((!isOwner && !isStaff) || user.getOrganization() == null) {
            throw new ForbiddenException("forbidden", "Solo el personal de la organización puede acceder a las políticas");
        }
        Long orgId = user.getOrganization().getId();
        Optional<OrganizationPolicy> policyOpt = policyRepository.findByOrganization_Id(orgId);

        List<OrganizationPolicyHistoryDto> history = !isOwner ? List.of() : historyRepository
                .findByOrganization_IdOrderByChangedAtDesc(orgId)
                .stream()
                .map(h -> OrganizationPolicyHistoryDto.builder()
                        .id(h.getId())
                        .changedAt(h.getChangedAt())
                        .changedByEmail(h.getChangedBy() != null ? h.getChangedBy().getUsername() : null)
                        .build())
                .toList();

        if (policyOpt.isEmpty()) {
            return OrganizationPolicyDto.builder()
                    .maxLostDateDays(LostDateLimitService.DEFAULT_MAX_LOST_DATE_DAYS)
                    .history(history)
                    .build();
        }

        OrganizationPolicy p = policyOpt.get();
        return OrganizationPolicyDto.builder()
                .maxStorageDays(p.getMaxStorageDays())
                .maxLostDateDays(p.getMaxLostDateDays() != null && p.getMaxLostDateDays() > 0
                        ? p.getMaxLostDateDays() : LostDateLimitService.DEFAULT_MAX_LOST_DATE_DAYS)
                .requiresIdentityValidation(p.getRequiresIdentityValidation())
                .requiresAdditionalEvidence(p.getRequiresAdditionalEvidence())
                .additionalEvidenceDetails(p.getAdditionalEvidenceDetails())
                .organizationType(p.getOrganizationType() != null ? p.getOrganizationType().name() : null)
                .history(history)
                .build();
    }

    @Transactional
    public void updatePolicy(UserEurekapp user, OrganizationPolicyDto dto) {
        if (user.getRole() != Role.ORGANIZATION_OWNER) {
            throw new ForbiddenException("forbidden", "Solo el responsable puede modificar las políticas");
        }
        LostDateLimitService.validateConfiguredDays(dto.getMaxLostDateDays());
        Long orgId = user.getOrganization().getId();
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new BadRequestException("org_not_found", "Organization not found"));

        Optional<OrganizationPolicy> existing = policyRepository.findByOrganization_Id(orgId);

        if (existing.isPresent()) {
            try {
                OrganizationPolicyDto previousDto = getPolicy(user);
                previousDto.setHistory(Collections.emptyList());
                String snapshot = objectMapper.writeValueAsString(previousDto);
                OrganizationPolicyHistory histEntry = OrganizationPolicyHistory.builder()
                        .organization(org)
                        .changedAt(LocalDateTime.now())
                        .changedBy(user)
                        .previousSnapshot(snapshot)
                        .build();
                historyRepository.save(histEntry);
            } catch (JsonProcessingException e) {
                // No bloquear si falla la serialización del snapshot
            }
        }

        OrganizationPolicy policy = existing.orElseGet(() -> OrganizationPolicy.builder()
                .organization(org)
                .build());

        policy.setMaxStorageDays(dto.getMaxStorageDays());
        policy.setMaxLostDateDays(dto.getMaxLostDateDays());
        policy.setRequiresIdentityValidation(dto.getRequiresIdentityValidation());
        policy.setRequiresAdditionalEvidence(dto.getRequiresAdditionalEvidence());
        policy.setAdditionalEvidenceDetails(dto.getAdditionalEvidenceDetails());
        policy.setOrganizationType(dto.getOrganizationType() != null
                ? OrganizationType.valueOf(dto.getOrganizationType()) : null);

        policyRepository.save(policy);
    }
}
