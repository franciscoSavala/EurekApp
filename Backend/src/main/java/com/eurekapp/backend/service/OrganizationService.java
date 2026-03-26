package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.OrganizationDto;
import com.eurekapp.backend.dto.response.OrganizationListResponseDto;
import com.eurekapp.backend.dto.response.OrganizationPolicyDto;
import com.eurekapp.backend.dto.response.OrganizationPolicyHistoryDto;
import com.eurekapp.backend.dto.command.SignUpOrganizationCommand;
import com.eurekapp.backend.exception.ForbbidenException;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.repository.IOrganizationPolicyHistoryRepository;
import com.eurekapp.backend.repository.IOrganizationPolicyRepository;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.IOrganizationRequestRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    private IOrganizationRequestRepository requestRepository;
    private IOrganizationPolicyRepository policyRepository;
    private IOrganizationPolicyHistoryRepository historyRepository;
    private ObjectMapper objectMapper;

    public OrganizationListResponseDto getAllOrganizations() {
        List<Organization> organizations = organizationRepository.findAll();
        List<OrganizationDto> organizationDtos = organizations.stream()
                .map(this::organizationToDto)
                .toList();
        return new OrganizationListResponseDto(organizationDtos);
    }

    public OrganizationDto organizationToDto(Organization organization) {
        return OrganizationDto.builder()
                .id(organization.getId())
                .name(organization.getName())
                .contactData(organization.getContactData())
                .build();
    }

    public void signUpOrganization(SignUpOrganizationCommand signUpOrganization) {
        OrganizationRequest organizationRequest = OrganizationRequest.builder()
                .contactEmail(signUpOrganization.getContactEmail())
                .requestData(signUpOrganization.getRequestData())
                .build();
        requestRepository.save(organizationRequest);
    }

    public OrganizationPolicyDto getPolicy(UserEurekapp user) {
        if (user.getRole() != Role.ORGANIZATION_OWNER) {
            throw new ForbbidenException("forbidden", "Solo el responsable puede acceder a las políticas");
        }
        Long orgId = user.getOrganization().getId();
        Optional<OrganizationPolicy> policyOpt = policyRepository.findByOrganization_Id(orgId);

        List<OrganizationPolicyHistoryDto> history = historyRepository
                .findByOrganizationIdOrderByChangedAtDesc(orgId)
                .stream()
                .map(h -> OrganizationPolicyHistoryDto.builder()
                        .id(h.getId())
                        .changedAt(h.getChangedAt())
                        .changedByEmail(h.getChangedBy() != null ? h.getChangedBy().getUsername() : null)
                        .build())
                .toList();

        if (policyOpt.isEmpty()) {
            return OrganizationPolicyDto.builder()
                    .notifyOnMatch(true)
                    .history(history)
                    .build();
        }

        OrganizationPolicy p = policyOpt.get();
        return OrganizationPolicyDto.builder()
                .maxStorageDays(p.getMaxStorageDays())
                .requiresIdentityValidation(p.getRequiresIdentityValidation())
                .identityValidationDetails(p.getIdentityValidationDetails())
                .deliveryProcess(p.getDeliveryProcess() != null ? p.getDeliveryProcess().name() : null)
                .requiresAdditionalEvidence(p.getRequiresAdditionalEvidence())
                .additionalEvidenceDetails(p.getAdditionalEvidenceDetails())
                .strictControlCategories(p.getStrictControlCategories())
                .notifyOnMatch(p.getNotifyOnMatch())
                .rewardPolicy(p.getRewardPolicy())
                .organizationType(p.getOrganizationType() != null ? p.getOrganizationType().name() : null)
                .history(history)
                .build();
    }

    public void updatePolicy(UserEurekapp user, OrganizationPolicyDto dto) {
        if (user.getRole() != Role.ORGANIZATION_OWNER) {
            throw new ForbbidenException("forbidden", "Solo el responsable puede modificar las políticas");
        }
        Long orgId = user.getOrganization().getId();
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ForbbidenException("forbidden", "Organización no encontrada"));

        Optional<OrganizationPolicy> existing = policyRepository.findByOrganization_Id(orgId);

        if (existing.isPresent()) {
            try {
                OrganizationPolicyDto previousDto = getPolicy(user);
                previousDto.setHistory(Collections.emptyList());
                String snapshot = objectMapper.writeValueAsString(previousDto);
                OrganizationPolicyHistory histEntry = OrganizationPolicyHistory.builder()
                        .organizationId(orgId)
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
        policy.setRequiresIdentityValidation(dto.getRequiresIdentityValidation());
        policy.setIdentityValidationDetails(dto.getIdentityValidationDetails());
        policy.setDeliveryProcess(dto.getDeliveryProcess() != null
                ? DeliveryProcess.valueOf(dto.getDeliveryProcess()) : null);
        policy.setRequiresAdditionalEvidence(dto.getRequiresAdditionalEvidence());
        policy.setAdditionalEvidenceDetails(dto.getAdditionalEvidenceDetails());
        policy.setStrictControlCategories(dto.getStrictControlCategories());
        policy.setNotifyOnMatch(dto.getNotifyOnMatch());
        policy.setRewardPolicy(dto.getRewardPolicy());
        policy.setOrganizationType(dto.getOrganizationType() != null
                ? OrganizationType.valueOf(dto.getOrganizationType()) : null);

        policyRepository.save(policy);
    }
}
