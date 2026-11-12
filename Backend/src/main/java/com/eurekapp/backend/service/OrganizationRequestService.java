package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.request.OrganizationRegistrationRequestDto;
import com.eurekapp.backend.dto.request.ResolveOrganizationRequestDto;
import com.eurekapp.backend.dto.response.*;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.ForbiddenException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.repository.*;
import com.eurekapp.backend.service.notification.NotificationService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;
import java.util.stream.Collectors;

/**
 * Circuito de solicitudes de alta de organización: el usuario la pide, la cancela o la consulta,
 * y el administrador la lista, ve su detalle y la aprueba o rechaza.
 */
@Slf4j
@AllArgsConstructor
@Service
public class OrganizationRequestService {

    private IOrganizationRepository organizationRepository;
    private IOrganizationRequestRepository requestRepository;
    private IUserRepository userRepository;
    private NotificationService notificationService;
    private InAppNotificationService inAppNotificationService;
    private EmailTemplateService emailTemplateService;
    private TransactionTemplate transactionTemplate;

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

        notifyAdminsNewRequest(requestingUser, dto, request.getId(), request.getCreatedAt());

        return OrganizationRegistrationResponseDto.builder()
                .requestId(request.getId())
                .message("Tu solicitud fue enviada correctamente. Un administrador la revisará a la brevedad.")
                .build();
    }

    // ── Mi solicitud (usuario) ────────────────────────────────────────────────

    public List<OrganizationRequestDetailDto> getMyOrganizationRequests(UserEurekapp user) {
        return requestRepository.findByRequestingUserOrderByCreatedAtDesc(user)
                .stream().map(this::toDetailDto).collect(Collectors.toList());
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

    public long getPendingRequestsCount(UserEurekapp admin) {
        if (admin.getRole() != Role.ADMIN) {
            throw new ForbiddenException("forbidden", "Solo el administrador puede consultar el conteo de solicitudes.");
        }
        return requestRepository.countByStatus(OrganizationRequestStatus.PENDING_APPROVAL);
    }

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

    /**
     * Mail que se registra dentro de la transacción y se arma y envía recién cuando ésta terminó:
     * una plantilla que falla no puede deshacer lo resuelto.
     */
    private record PendingEmail(String to, String subject, Supplier<String> body, String warnMessage) {}

    public void resolveOrganizationRequest(UserEurekapp admin, Long requestId,
                                            ResolveOrganizationRequestDto dto) {
        if (admin.getRole() != Role.ADMIN) {
            throw new ForbiddenException("forbidden", "Solo el administrador puede resolver solicitudes.");
        }

        // Todas las escrituras van juntas: si un paso falla no queda la organización creada,
        // el responsable promovido ni la solicitud a medias. Los mails se registran acá adentro
        // pero se mandan recién después, para no avisar de algo que se terminó deshaciendo.
        List<PendingEmail> pendingEmails = transactionTemplate.execute(status -> {
            List<PendingEmail> emails = new ArrayList<>();

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
                request.setOrganization(org);

                Optional<UserEurekapp> ownerOpt = userRepository.findByUsername(request.getOwnerEmail());
                if (ownerOpt.isPresent()) {
                    UserEurekapp owner = ownerOpt.get();
                    owner.setRole(Role.ORGANIZATION_OWNER);
                    owner.setOrganization(org);
                    userRepository.save(owner);

                    inAppNotificationService.createNotification(owner,
                            "Sos responsable de una nueva organización",
                            "Tu cuenta fue asignada como responsable de \"" + org.getName() + "\" en EurekApp.",
                            "ROLE_CHANGED", null);
                    emails.add(new PendingEmail(owner.getUsername(),
                            "EurekApp — Sos el responsable de una organización",
                            () -> emailTemplateService.buildOrgOwnerApprovedEmail(owner.getFirstName(), org.getName()),
                            "No se pudo enviar email al owner " + owner.getUsername()));
                } else {
                    // El responsable designado aún no tiene cuenta en EurekApp: se le invita por email
                    // a registrarse usando el mismo correo para quedar vinculado automáticamente.
                    emails.add(new PendingEmail(request.getOwnerEmail(),
                            "EurekApp — Sos el responsable de una organización",
                            () -> emailTemplateService.buildOrgOwnerInvitedEmail(
                                    request.getOwnerFirstName(), org.getName(), request.getOwnerEmail()),
                            "No se pudo enviar email al owner designado " + request.getOwnerEmail()));
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

            // El solicitante puede ser un proxy: su nombre se lee mientras la sesión sigue abierta.
            String requesterFirstName = request.getRequestingUser().getFirstName();
            emails.add(new PendingEmail(request.getRequestingUser().getUsername(),
                    "EurekApp — Resolución de tu solicitud de organización",
                    () -> emailTemplateService.buildOrgRequestResolvedEmail(
                            requesterFirstName,
                            request.getOrganizationName(),
                            approved, dto.getAdminNote()),
                    "No se pudo enviar email de resolución a " + request.getRequestingUser().getUsername()));
            return emails;
        });

        for (PendingEmail email : pendingEmails) {
            try {
                notificationService.sendNotification(email.to(), email.subject(), email.body().get());
            } catch (Exception e) {
                log.warn("{}: {}", email.warnMessage(), e.getMessage());
            }
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
                                         OrganizationRegistrationRequestDto dto, Long requestId,
                                         LocalDateTime createdAt) {
        List<UserEurekapp> admins = userRepository.findAllByRole(Role.ADMIN);
        String description = requestingUser.getFirstName() + " " + requestingUser.getLastName()
                + " solicita registrar \"" + dto.getOrganizationName() + "\" como organización.";
        String createdAtFormatted = createdAt != null
                ? createdAt.format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")) : "";
        String emailBody = emailTemplateService.buildOrgRequestNewEmail(
                requestingUser.getFirstName(), requestingUser.getLastName(), requestingUser.getUsername(),
                dto.getOrganizationName(), dto.getOrganizationType().name(),
                dto.getCustomOrganizationType(),
                dto.getStreet(), dto.getStreetNumber(), dto.getCity(), dto.getProvince(), dto.getCountry(),
                dto.getLatitude(), dto.getLongitude(),
                dto.getOwnerFirstName(), dto.getOwnerLastName(),
                dto.getOwnerEmail(), dto.getOwnerPhone(), dto.getReason(), createdAtFormatted);

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
}
