package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.response.FraudAlertDto;
import com.eurekapp.backend.dto.response.FraudUserReportEntryDto;
import com.eurekapp.backend.exception.ForbbidenException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.repository.IFraudAlertRepository;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.ISearchFeedbackRepository;
import com.eurekapp.backend.service.notification.NotificationService;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@AllArgsConstructor
@Service
public class FraudDetectionService {

    private final IFraudAlertRepository alertRepository;
    private final ISearchFeedbackRepository feedbackRepository;
    private final NotificationService notificationService;
    private final IOrganizationRepository organizationRepository;

    public void checkForFraud(String orgId, String foundObjectUUID, UserEurekapp claimer) {
        checkMultipleClaimers(orgId, foundObjectUUID, claimer);
        checkHighClaimFrequency(orgId, claimer);
    }

    private void checkMultipleClaimers(String orgId, String foundObjectUUID, UserEurekapp claimer) {
        long count = feedbackRepository
                .countByOrganizationIdAndFoundObjectUUIDAndWasFoundTrue(orgId, foundObjectUUID);
        if (count > 1) {
            createAlertIfAbsent(orgId, foundObjectUUID, claimer,
                    "MULTIPLE_CLAIMERS_SAME_OBJECT",
                    "Múltiples usuarios reclamaron ser dueños del objeto con UUID: "
                            + foundObjectUUID + ". Total de reclamantes: " + count);
        }
    }

    private void checkHighClaimFrequency(String orgId, UserEurekapp claimer) {
        LocalDateTime since = LocalDateTime.now().minusDays(30);
        long count = feedbackRepository
                .countByOrganizationIdAndUserAndWasFoundTrueAndCreatedAtAfter(orgId, claimer, since);
        if (count > 3) {
            createAlertIfAbsent(orgId, null, claimer,
                    "HIGH_CLAIM_FREQUENCY",
                    "El usuario " + claimer.getUsername()
                            + " reclamó " + count + " objetos en los últimos 30 días en esta organización.");
        }
    }

    private void createAlertIfAbsent(String orgId, String uuid, UserEurekapp suspect,
                                     String reason, String details) {
        boolean exists = alertRepository
                .existsByOrganizationIdAndFoundObjectUUIDAndSuspectUserAndReasonAndStatus(
                        orgId, uuid, suspect, reason, FraudAlertStatus.PENDING);
        if (exists) return;

        FraudAlert alert = FraudAlert.builder()
                .organizationId(orgId)
                .foundObjectUUID(uuid)
                .suspectUser(suspect)
                .reason(reason)
                .details(details)
                .status(FraudAlertStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .build();
        alertRepository.save(alert);
        notifyOwner(orgId, alert);
    }

    private void notifyOwner(String orgId, FraudAlert alert) {
        try {
            organizationRepository.findById(Long.parseLong(orgId)).ifPresent(org -> {
                String content = "Se detectó una posible actividad fraudulenta en su organización.\n\n"
                        + "Motivo: " + alert.getReason() + "\n"
                        + "Detalle: " + alert.getDetails() + "\n"
                        + "Fecha: " + alert.getCreatedAt() + "\n\n"
                        + "Ingrese a la aplicación para revisar y resolver la alerta.";
                notificationService.sendNotification(org.getContactData(),
                        "Alerta de fraude detectada - EurekApp", content);
            });
        } catch (Exception e) {
            // No bloquear el flujo principal si falla la notificación
        }
    }

    public List<FraudAlertDto> getAlerts(UserEurekapp user) {
        validateAccess(user);
        String orgId = user.getOrganization().getId().toString();
        return alertRepository.findByOrganizationIdOrderByCreatedAtDesc(orgId)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    public FraudAlertDto getAlertDetail(Long alertId, UserEurekapp user) {
        validateAccess(user);
        FraudAlert alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new NotFoundException("fraud_alert_not_found", "Alerta no encontrada"));
        if (!alert.getOrganizationId().equals(user.getOrganization().getId().toString())) {
            throw new ForbbidenException("forbidden", "No tienes acceso a esta alerta");
        }
        return toDto(alert);
    }

    public void resolve(Long alertId, UserEurekapp user, FraudAlertStatus resolution) {
        validateAccess(user);
        FraudAlert alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new NotFoundException("fraud_alert_not_found", "Alerta no encontrada"));
        if (!alert.getOrganizationId().equals(user.getOrganization().getId().toString())) {
            throw new ForbbidenException("forbidden", "No tienes acceso a esta alerta");
        }
        alert.setStatus(resolution);
        alert.setResolvedAt(LocalDateTime.now());
        alert.setResolvedBy(user);
        alertRepository.save(alert);
    }

    public List<FraudUserReportEntryDto> getFraudUserReport(
            UserEurekapp user, LocalDate from, LocalDate to, FraudAlertStatus status) {
        if (user.getRole() != Role.ORGANIZATION_OWNER) {
            throw new ForbbidenException("forbidden",
                    "Solo el responsable de la organización puede acceder al reporte de fraude");
        }
        String orgId = user.getOrganization().getId().toString();
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.plusDays(1).atStartOfDay();

        List<FraudAlert> alerts = status != null
                ? alertRepository.findByOrganizationIdAndStatusAndCreatedAtBetween(orgId, status, fromDt, toDt)
                : alertRepository.findByOrganizationIdAndCreatedAtBetween(orgId, fromDt, toDt);

        Map<Long, List<FraudAlert>> byUser = alerts.stream()
                .filter(a -> a.getSuspectUser() != null)
                .collect(Collectors.groupingBy(a -> a.getSuspectUser().getId()));

        return byUser.values().stream()
                .map(group -> {
                    UserEurekapp suspect = group.get(0).getSuspectUser();
                    long confirmedCount = group.stream()
                            .filter(a -> a.getStatus() == FraudAlertStatus.CONFIRMED_FRAUD).count();
                    List<String> reasons = group.stream()
                            .map(FraudAlert::getReason).distinct().collect(Collectors.toList());
                    String suggested = confirmedCount >= 4 ? "Bloqueo"
                            : confirmedCount >= 2 ? "Suspensión temporal"
                            : confirmedCount == 1 ? "Advertencia"
                            : "Sin acción sugerida";
                    return FraudUserReportEntryDto.builder()
                            .userId(suspect.getId())
                            .email(suspect.getUsername())
                            .fullName(suspect.getFirstName() + " " + suspect.getLastName())
                            .fraudCount(group.size())
                            .confirmedFraudCount(confirmedCount)
                            .reasons(reasons)
                            .suggestedAction(suggested)
                            .incidents(group.stream().map(this::toDto).collect(Collectors.toList()))
                            .build();
                })
                .sorted(Comparator.comparingLong(FraudUserReportEntryDto::getConfirmedFraudCount)
                        .thenComparingLong(FraudUserReportEntryDto::getFraudCount).reversed())
                .collect(Collectors.toList());
    }

    public byte[] exportFraudReportCsv(
            UserEurekapp user, LocalDate from, LocalDate to, FraudAlertStatus status) {
        List<FraudUserReportEntryDto> report = getFraudUserReport(user, from, to, status);
        StringBuilder sb = new StringBuilder(
                "userId,email,fullName,fraudCount,confirmedFraudCount,reasons,suggestedAction\n");
        for (FraudUserReportEntryDto entry : report) {
            sb.append(entry.getUserId()).append(',')
              .append(entry.getEmail()).append(',')
              .append(entry.getFullName().replace(",", " ")).append(',')
              .append(entry.getFraudCount()).append(',')
              .append(entry.getConfirmedFraudCount()).append(',')
              .append(String.join("|", entry.getReasons())).append(',')
              .append(entry.getSuggestedAction()).append('\n');
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    private void validateAccess(UserEurekapp user) {
        if (user.getRole() != Role.ORGANIZATION_OWNER && user.getRole() != Role.ENCARGADO) {
            throw new ForbbidenException("forbidden",
                    "Solo el encargado o responsable de la organización puede gestionar alertas de fraude");
        }
    }

    private FraudAlertDto toDto(FraudAlert a) {
        return FraudAlertDto.builder()
                .id(a.getId())
                .organizationId(a.getOrganizationId())
                .foundObjectUUID(a.getFoundObjectUUID())
                .suspectUserEmail(a.getSuspectUser() != null ? a.getSuspectUser().getUsername() : null)
                .suspectUserFullName(a.getSuspectUser() != null
                        ? a.getSuspectUser().getFirstName() + " " + a.getSuspectUser().getLastName()
                        : null)
                .reason(a.getReason())
                .details(a.getDetails())
                .status(a.getStatus().name())
                .createdAt(a.getCreatedAt())
                .resolvedAt(a.getResolvedAt())
                .resolvedByEmail(a.getResolvedBy() != null ? a.getResolvedBy().getUsername() : null)
                .build();
    }
}
