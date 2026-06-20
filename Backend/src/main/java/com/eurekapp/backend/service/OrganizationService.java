package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.OrganizationDto;
import com.eurekapp.backend.dto.request.OrganizationRegistrationRequestDto;
import com.eurekapp.backend.dto.request.ResolveOrganizationRequestDto;
import com.eurekapp.backend.dto.response.*;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.ForbiddenException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.repository.*;
import com.eurekapp.backend.service.notification.NotificationService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@AllArgsConstructor
@Service
public class OrganizationService {

    private IOrganizationRepository organizationRepository;
    private IOrganizationRequestRepository requestRepository;
    private IOrganizationPolicyRepository policyRepository;
    private IOrganizationPolicyHistoryRepository historyRepository;
    private ObjectMapper objectMapper;
    private IUserRepository userRepository;
    private NotificationService notificationService;
    private InAppNotificationService inAppNotificationService;
    private EmailTemplateService emailTemplateService;

    public OrganizationListResponseDto getAllOrganizations() {
        List<OrganizationDto> organizationDtos = organizationRepository.findAll().stream()
                .filter(Organization::isActive)
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

    // ── Alta de organización ──────────────────────────────────────────────────

    public OrganizationRegistrationResponseDto signUpOrganization(UserEurekapp requestingUser,
                                                                   OrganizationRegistrationRequestDto dto) {
        if (requestingUser.getRole() != Role.USER) {
            throw new ForbiddenException("forbidden",
                    "Solo los usuarios regulares pueden solicitar el registro de una organización.");
        }

        if (!requestRepository.findByRequestingUserAndStatus(requestingUser,
                OrganizationRequestStatus.PENDING_APPROVAL).isEmpty()) {
            throw new BadRequestException("request_already_pending",
                    "Ya tenés una solicitud de organización pendiente de aprobación.");
        }

        if (!dto.getProvince().trim().equalsIgnoreCase("Córdoba")) {
            throw new BadRequestException("province_not_supported",
                    "Por el momento solo se aceptan organizaciones de la provincia de Córdoba.");
        }
        if (!dto.getCountry().trim().equalsIgnoreCase("Argentina")) {
            throw new BadRequestException("country_not_supported",
                    "Por el momento solo se aceptan organizaciones de Argentina.");
        }

        if (dto.getOrganizationType() == OrganizationType.OTHER
                && (dto.getCustomOrganizationType() == null || dto.getCustomOrganizationType().isBlank())) {
            throw new BadRequestException("custom_type_required",
                    "Debés especificar el tipo de organización cuando seleccionás 'Otro'.");
        }

        if (userRepository.findByUsernameAndRole(dto.getOwnerEmail(), Role.ORGANIZATION_OWNER).isPresent()) {
            throw new BadRequestException("owner_email_already_in_use",
                    "El correo electrónico del responsable ya está asociado a una organización en EurekApp.");
        }

        OrganizationRequest request = OrganizationRequest.builder()
                .requestingUser(requestingUser)
                .organizationName(dto.getOrganizationName())
                .organizationType(dto.getOrganizationType())
                .customOrganizationType(dto.getCustomOrganizationType())
                .street(dto.getStreet())
                .streetNumber(dto.getStreetNumber())
                .city(dto.getCity())
                .province(dto.getProvince())
                .country(dto.getCountry())
                .coordinates(new GeoCoordinates(dto.getLatitude(), dto.getLongitude()))
                .ownerFirstName(dto.getOwnerFirstName())
                .ownerLastName(dto.getOwnerLastName())
                .ownerEmail(dto.getOwnerEmail())
                .ownerPhone(dto.getOwnerPhone())
                .reason(dto.getReason())
                .status(OrganizationRequestStatus.PENDING_APPROVAL)
                .createdAt(LocalDateTime.now())
                .build();
        requestRepository.save(request);

        try {
            notificationService.sendNotification(
                    requestingUser.getUsername(),
                    "EurekApp — Solicitud de organización recibida",
                    emailTemplateService.buildOrgRequestSubmittedEmail(
                            requestingUser.getFirstName(),
                            dto.getOrganizationName(), dto.getOrganizationType().name(),
                            dto.getCustomOrganizationType(),
                            dto.getStreet(), dto.getStreetNumber(), dto.getCity(),
                            dto.getProvince(), dto.getCountry(),
                            dto.getOwnerFirstName(), dto.getOwnerLastName(),
                            dto.getOwnerEmail(), dto.getOwnerPhone(), dto.getReason()));
        } catch (Exception e) {
            log.warn("No se pudo enviar email de confirmación a {}: {}", requestingUser.getUsername(), e.getMessage());
        }

        notifyAdminsNewRequest(requestingUser, dto, request.getId());

        return OrganizationRegistrationResponseDto.builder()
                .requestId(request.getId())
                .message("Tu solicitud fue enviada correctamente. Un administrador la revisará a la brevedad.")
                .build();
    }

    // ── Mi solicitud (usuario) ────────────────────────────────────────────────

    public OrganizationRequestDetailDto getMyOrganizationRequest(UserEurekapp user) {
        OrganizationRequest request = requestRepository
                .findFirstByRequestingUserOrderByCreatedAtDesc(user)
                .orElseThrow(() -> new NotFoundException("request_not_found",
                        "No encontramos ninguna solicitud para tu cuenta."));
        return toDetailDto(request);
    }

    public void cancelOrganizationRequest(UserEurekapp user, Long requestId) {
        OrganizationRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new NotFoundException("request_not_found", "Solicitud no encontrada."));

        if (!request.getRequestingUser().getId().equals(user.getId())) {
            throw new ForbiddenException("forbidden", "No podés cancelar una solicitud que no es tuya.");
        }
        if (request.getStatus() != OrganizationRequestStatus.PENDING_APPROVAL) {
            throw new BadRequestException("cannot_cancel",
                    "Solo podés cancelar solicitudes que estén pendientes de aprobación.");
        }
        request.setStatus(OrganizationRequestStatus.CANCELLED);
        requestRepository.save(request);
    }

    // ── Admin: listado y detalle ──────────────────────────────────────────────

    public List<OrganizationRequestSummaryDto> getOrganizationRequests(UserEurekapp admin) {
        if (admin.getRole() != Role.ADMIN) {
            throw new ForbiddenException("forbidden", "Solo el administrador puede ver las solicitudes.");
        }
        return requestRepository.findAll().stream()
                .map(r -> OrganizationRequestSummaryDto.builder()
                        .id(r.getId())
                        .organizationName(r.getOrganizationName())
                        .organizationType(r.getOrganizationType().name())
                        .city(r.getCity())
                        .ownerEmail(r.getOwnerEmail())
                        .status(r.getStatus().name())
                        .createdAt(r.getCreatedAt())
                        .requestingUserEmail(r.getRequestingUser().getUsername())
                        .build())
                .collect(Collectors.toList());
    }

    public OrganizationRequestDetailDto getOrganizationRequestDetail(UserEurekapp admin, Long requestId) {
        if (admin.getRole() != Role.ADMIN) {
            throw new ForbiddenException("forbidden", "Solo el administrador puede ver el detalle de solicitudes.");
        }
        OrganizationRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new NotFoundException("request_not_found", "Solicitud no encontrada."));
        return toDetailDto(request);
    }

    // ── Admin: resolución ─────────────────────────────────────────────────────

    public void resolveOrganizationRequest(UserEurekapp admin, Long requestId,
                                            ResolveOrganizationRequestDto dto) {
        if (admin.getRole() != Role.ADMIN) {
            throw new ForbiddenException("forbidden", "Solo el administrador puede resolver solicitudes.");
        }

        OrganizationRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new NotFoundException("request_not_found", "Solicitud no encontrada."));

        if (request.getStatus() != OrganizationRequestStatus.PENDING_APPROVAL) {
            throw new BadRequestException("already_resolved", "La solicitud ya fue procesada.");
        }

        if (dto.getResolution() == OrganizationRequestStatus.REJECTED
                && (dto.getAdminNote() == null || dto.getAdminNote().isBlank())) {
            throw new BadRequestException("admin_note_required",
                    "Debés ingresar un motivo al rechazar una solicitud.");
        }

        if (dto.getResolution() == OrganizationRequestStatus.APPROVED) {
            Organization org = Organization.builder()
                    .name(request.getOrganizationName())
                    .contactData(request.getOwnerEmail())
                    .street(request.getStreet())
                    .streetNumber(request.getStreetNumber())
                    .city(request.getCity())
                    .province(request.getProvince())
                    .country(request.getCountry())
                    .organizationType(request.getOrganizationType())
                    .coordinates(request.getCoordinates())
                    .build();
            organizationRepository.save(org);

            Optional<UserEurekapp> ownerOpt = userRepository.findByUsername(request.getOwnerEmail());
            if (ownerOpt.isPresent()) {
                UserEurekapp owner = ownerOpt.get();
                owner.setRole(Role.ORGANIZATION_OWNER);
                owner.setOrganization(org);
                userRepository.save(owner);

                if (!owner.getId().equals(request.getRequestingUser().getId())) {
                    inAppNotificationService.createNotification(owner,
                            "Sos responsable de una nueva organización",
                            "Tu cuenta fue asignada como responsable de \"" + org.getName() + "\" en EurekApp.",
                            "ROLE_CHANGED", null);
                    try {
                        notificationService.sendNotification(owner.getUsername(),
                                "EurekApp — Sos el responsable de una organización",
                                emailTemplateService.buildOrgOwnerApprovedEmail(owner.getFirstName(), org.getName()));
                    } catch (Exception e) {
                        log.warn("No se pudo enviar email al owner {}: {}", owner.getUsername(), e.getMessage());
                    }
                }
            } else {
                // El responsable designado aún no tiene cuenta en EurekApp: se le invita por email
                // a registrarse usando el mismo correo para quedar vinculado automáticamente.
                try {
                    notificationService.sendNotification(
                            request.getOwnerEmail(),
                            "EurekApp — Sos el responsable de una organización",
                            emailTemplateService.buildOrgOwnerInvitedEmail(
                                    request.getOwnerFirstName(), org.getName(), request.getOwnerEmail()));
                } catch (Exception e) {
                    log.warn("No se pudo enviar email al owner designado {}: {}", request.getOwnerEmail(), e.getMessage());
                }
            }
        }

        request.setStatus(dto.getResolution());
        request.setResolvedAt(LocalDateTime.now());
        request.setResolvedBy(admin);
        request.setAdminNote(dto.getAdminNote());
        requestRepository.save(request);

        boolean approved = dto.getResolution() == OrganizationRequestStatus.APPROVED;
        String notifType = approved ? "ORG_REQUEST_APPROVED" : "ORG_REQUEST_REJECTED";
        String notifTitle = approved ? "Tu solicitud fue aprobada" : "Tu solicitud fue rechazada";
        String noteText = (dto.getAdminNote() != null && !dto.getAdminNote().isBlank())
                ? " Nota: " + dto.getAdminNote() : "";
        String notifDesc = approved
                ? "Tu solicitud para \"" + request.getOrganizationName() + "\" fue aprobada." + noteText
                : "Tu solicitud para \"" + request.getOrganizationName() + "\" fue rechazada." + noteText;

        inAppNotificationService.createNotification(request.getRequestingUser(),
                notifTitle, notifDesc, notifType, null);

        try {
            notificationService.sendNotification(
                    request.getRequestingUser().getUsername(),
                    "EurekApp — Resolución de tu solicitud de organización",
                    emailTemplateService.buildOrgRequestResolvedEmail(
                            request.getRequestingUser().getFirstName(),
                            request.getOrganizationName(),
                            approved, dto.getAdminNote()));
        } catch (Exception e) {
            log.warn("No se pudo enviar email de resolución a {}: {}",
                    request.getRequestingUser().getUsername(), e.getMessage());
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private OrganizationRequestDetailDto toDetailDto(OrganizationRequest r) {
        return OrganizationRequestDetailDto.builder()
                .id(r.getId())
                .organizationName(r.getOrganizationName())
                .organizationType(r.getOrganizationType().name())
                .customOrganizationType(r.getCustomOrganizationType())
                .street(r.getStreet())
                .streetNumber(r.getStreetNumber())
                .city(r.getCity())
                .province(r.getProvince())
                .country(r.getCountry())
                .latitude(r.getCoordinates() != null ? r.getCoordinates().getLatitude() : null)
                .longitude(r.getCoordinates() != null ? r.getCoordinates().getLongitude() : null)
                .ownerFirstName(r.getOwnerFirstName())
                .ownerLastName(r.getOwnerLastName())
                .ownerEmail(r.getOwnerEmail())
                .ownerPhone(r.getOwnerPhone())
                .reason(r.getReason())
                .status(r.getStatus().name())
                .createdAt(r.getCreatedAt())
                .requestingUserEmail(r.getRequestingUser().getUsername())
                .requestingUserFirstName(r.getRequestingUser().getFirstName())
                .requestingUserLastName(r.getRequestingUser().getLastName())
                .resolvedAt(r.getResolvedAt())
                .resolvedByEmail(r.getResolvedBy() != null ? r.getResolvedBy().getUsername() : null)
                .adminNote(r.getAdminNote())
                .build();
    }

    private void notifyAdminsNewRequest(UserEurekapp requestingUser,
                                         OrganizationRegistrationRequestDto dto, Long requestId) {
        List<UserEurekapp> admins = userRepository.findAllByRole(Role.ADMIN);
        String description = requestingUser.getFirstName() + " " + requestingUser.getLastName()
                + " solicita registrar \"" + dto.getOrganizationName() + "\" como organización.";
        String emailBody = emailTemplateService.buildOrgRequestNewEmail(
                requestingUser.getFirstName(), requestingUser.getLastName(), requestingUser.getUsername(),
                dto.getOrganizationName(), dto.getOrganizationType().name(),
                dto.getCustomOrganizationType(),
                dto.getStreet(), dto.getStreetNumber(), dto.getCity(), dto.getProvince(), dto.getCountry(),
                dto.getLatitude(), dto.getLongitude(),
                dto.getOwnerFirstName(), dto.getOwnerLastName(),
                dto.getOwnerEmail(), dto.getOwnerPhone(), dto.getReason());

        for (UserEurekapp admin : admins) {
            inAppNotificationService.createNotification(admin,
                    "Nueva solicitud de organización", description,
                    "ORG_REGISTRATION_REQUEST", requestId);
            try {
                notificationService.sendNotification(admin.getUsername(),
                        "EurekApp — Nueva solicitud de registro de organización", emailBody);
            } catch (Exception e) {
                log.warn("No se pudo enviar email al admin {}: {}", admin.getUsername(), e.getMessage());
            }
        }
    }

    // ── Políticas ─────────────────────────────────────────────────────────────

    public OrganizationPolicyDto getPolicy(UserEurekapp user) {
        if (user.getRole() != Role.ORGANIZATION_OWNER) {
            throw new ForbiddenException("forbidden", "Solo el responsable puede acceder a las políticas");
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
                    .history(history)
                    .build();
        }

        OrganizationPolicy p = policyOpt.get();
        return OrganizationPolicyDto.builder()
                .maxStorageDays(p.getMaxStorageDays())
                .requiresIdentityValidation(p.getRequiresIdentityValidation())
                .requiresAdditionalEvidence(p.getRequiresAdditionalEvidence())
                .additionalEvidenceDetails(p.getAdditionalEvidenceDetails())
                .organizationType(p.getOrganizationType() != null ? p.getOrganizationType().name() : null)
                .history(history)
                .build();
    }

    public void updatePolicy(UserEurekapp user, OrganizationPolicyDto dto) {
        if (user.getRole() != Role.ORGANIZATION_OWNER) {
            throw new ForbiddenException("forbidden", "Solo el responsable puede modificar las políticas");
        }
        Long orgId = user.getOrganization().getId();
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ForbiddenException("forbidden", "Organización no encontrada"));

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
        policy.setRequiresAdditionalEvidence(dto.getRequiresAdditionalEvidence());
        policy.setAdditionalEvidenceDetails(dto.getAdditionalEvidenceDetails());
        policy.setOrganizationType(dto.getOrganizationType() != null
                ? OrganizationType.valueOf(dto.getOrganizationType()) : null);

        policyRepository.save(policy);
    }
}
