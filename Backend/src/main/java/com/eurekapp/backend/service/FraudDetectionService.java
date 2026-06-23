package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.response.FraudAlertDto;
import com.eurekapp.backend.dto.response.FraudClaimantDto;
import com.eurekapp.backend.dto.response.FraudUserReportEntryDto;
import com.eurekapp.backend.exception.ForbiddenException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.model.Reclamo;
import com.eurekapp.backend.repository.FoundObjectRepository;
import com.eurekapp.backend.repository.IFraudAlertRepository;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.IReclamoRepository;
import com.eurekapp.backend.repository.ISearchFeedbackRepository;
import com.eurekapp.backend.repository.IUserRepository;
import com.eurekapp.backend.service.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RequiredArgsConstructor
@Service
public class FraudDetectionService {

    private final IFraudAlertRepository alertRepository;
    private final ISearchFeedbackRepository feedbackRepository;
    private final NotificationService notificationService;
    private final IOrganizationRepository organizationRepository;
    private final IUserRepository userRepository;
    private final InAppNotificationService inAppNotificationService;
    private final IReclamoRepository reclamoRepository;
    private final FoundObjectRepository foundObjectRepository;
    private final EmailTemplateService emailTemplateService;

    @Value("${fraud.finder-claimer-collusion-threshold:2}")
    private int finderClaimerCollusionThreshold;

    public void checkForFraud(String orgId, String foundObjectUUID, UserEurekapp claimer, String claimDescription, FoundObject foundObject) {
        checkFinderClaimerCollusion(orgId, foundObjectUUID, claimer, foundObject);
    }

    private void checkFinderClaimerCollusion(String orgId, String currentUUID, UserEurekapp claimer, FoundObject foundObject) {
        if (foundObject == null || foundObject.getObjectFinderUser() == null) return;
        UserEurekapp finder = foundObject.getObjectFinderUser();
        if (finder.getId().equals(claimer.getId())) return;

        List<Reclamo> claimerHistory = reclamoRepository.findByUser_Id(claimer.getId()).stream()
                .filter(r -> r.getOrganizationId().equals(orgId))
                .filter(r -> !currentUUID.equals(r.getFoundObjectUUID()))
                .toList();

        long collusionCount = claimerHistory.stream()
                .filter(r -> r.getFoundObjectUUID() != null)
                .filter(r -> {
                    try {
                        FoundObject prev = foundObjectRepository.getByUuid(r.getFoundObjectUUID());
                        return prev != null && prev.getObjectFinderUser() != null
                                && prev.getObjectFinderUser().getId().equals(finder.getId());
                    } catch (Exception e) {
                        return false;
                    }
                })
                .count();

        if (collusionCount + 1 >= finderClaimerCollusionThreshold) {
            createAlertIfAbsent(orgId, currentUUID, claimer,
                    "FINDER_CLAIMER_COLLUSION",
                    "El usuario " + claimer.getUsername() + " reclamó " + (collusionCount + 1)
                            + " objetos encontrados por el mismo usuario (" + finder.getUsername()
                            + ") en esta organización. Posible acuerdo entre registrador y reclamante.");
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
        notifyOrgStaffInApp(orgId, alert);
    }

    private void notifyOwner(String orgId, FraudAlert alert) {
        try {
            organizationRepository.findById(Long.parseLong(orgId)).ifPresent(org -> {
                String content = emailTemplateService.buildFraudAlertEmail(
                        org.getName(), alert.getReason(), alert.getDetails(),
                        alert.getCreatedAt().toString());
                notificationService.sendNotification(org.getContactData(),
                        "Alerta de fraude detectada — EurekApp", content);
            });
        } catch (Exception e) {
            // No bloquear el flujo principal si falla la notificación
        }
    }

    private void notifyOrgStaffInApp(String orgId, FraudAlert alert) {
        try {
            organizationRepository.findById(Long.parseLong(orgId)).ifPresent(org -> {
                List<UserEurekapp> staff = userRepository.findByOrganizationAndRoleIn(
                        org, List.of(Role.ORGANIZATION_OWNER, Role.ENCARGADO));
                for (UserEurekapp member : staff) {
                    inAppNotificationService.createNotification(
                            member,
                            "Nueva alerta de fraude",
                            "Motivo: " + alert.getReason() + ". " + alert.getDetails(),
                            "FRAUD_ALERT",
                            alert.getId()
                    );
                }
            });
        } catch (Exception e) {
            // No bloquear el flujo principal si falla la notificación in-app
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
            throw new ForbiddenException("forbidden", "No tienes acceso a esta alerta");
        }
        return toDto(alert);
    }

    public void resolve(Long alertId, UserEurekapp user, FraudAlertStatus resolution) {
        validateAccess(user);
        FraudAlert alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new NotFoundException("fraud_alert_not_found", "Alerta no encontrada"));
        if (!alert.getOrganizationId().equals(user.getOrganization().getId().toString())) {
            throw new ForbiddenException("forbidden", "No tienes acceso a esta alerta");
        }
        alert.setStatus(resolution);
        alert.setResolvedAt(LocalDateTime.now());
        alert.setResolvedBy(user);
        alertRepository.save(alert);
    }

    public List<FraudUserReportEntryDto> getFraudUserReport(
            UserEurekapp user, LocalDate from, LocalDate to, FraudAlertStatus status, Long organizationId) {
        if (user.getRole() != Role.ADMIN) {
            throw new ForbiddenException("forbidden",
                    "Solo el administrador de EurekApp puede acceder al reporte de fraude");
        }
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.plusDays(1).atStartOfDay();

        // Determinar el orgId efectivo para filtrar alertas
        String orgIdFilter = organizationId != null ? organizationId.toString() : null;

        // Paso 1: alertas filtradas (status + fecha) para determinar qué usuarios aparecen
        List<FraudAlert> filteredAlerts;
        if (orgIdFilter != null) {
            filteredAlerts = status != null
                    ? alertRepository.findByOrganizationIdAndStatusAndCreatedAtBetween(orgIdFilter, status, fromDt, toDt)
                    : alertRepository.findByOrganizationIdAndCreatedAtBetween(orgIdFilter, fromDt, toDt);
        } else {
            filteredAlerts = status != null
                    ? alertRepository.findByStatusAndCreatedAtBetween(status, fromDt, toDt)
                    : alertRepository.findByCreatedAtBetween(fromDt, toDt);
        }

        // Paso 2: IDs únicos de usuarios del conjunto filtrado
        Set<Long> suspectIds = filteredAlerts.stream()
                .filter(a -> a.getSuspectUser() != null)
                .map(a -> a.getSuspectUser().getId())
                .collect(Collectors.toSet());

        // Paso 3: para cada usuario, cargar TODOS sus casos (en la org si se filtró, o en todas)
        return suspectIds.stream().map(userId -> {
            List<FraudAlert> all = orgIdFilter != null
                    ? alertRepository.findByOrganizationIdAndSuspectUser_Id(orgIdFilter, userId)
                    : alertRepository.findBySuspectUser_Id(userId);
            UserEurekapp suspect = all.get(0).getSuspectUser();

            long confirmed = all.stream()
                    .filter(a -> a.getStatus() == FraudAlertStatus.CONFIRMED_FRAUD).count();
            long pending = all.stream()
                    .filter(a -> a.getStatus() == FraudAlertStatus.PENDING).count();
            List<String> reasons = all.stream()
                    .map(FraudAlert::getReason).distinct().collect(Collectors.toList());

            int gravity = confirmed >= 4 ? 3 : confirmed >= 2 ? 2 : confirmed == 1 ? 1 : 0;
            String action = gravity == 3 ? "Bloqueo"
                    : gravity == 2 ? "Suspensión temporal"
                    : gravity == 1 ? "Advertencia"
                    : "Sin acción sugerida";

            return FraudUserReportEntryDto.builder()
                    .userId(suspect.getId())
                    .email(suspect.getUsername())
                    .fullName(suspect.getFirstName() + " " + suspect.getLastName())
                    .fraudCount(all.size())
                    .confirmedFraudCount(confirmed)
                    .pendingCount(pending)
                    .gravityLevel(gravity)
                    .reasons(reasons)
                    .suggestedAction(action)
                    .incidents(all.stream()
                            .sorted(Comparator.comparing(FraudAlert::getCreatedAt).reversed())
                            .map(this::toDto)
                            .collect(Collectors.toList()))
                    .build();
        }).sorted(Comparator.comparingInt(FraudUserReportEntryDto::getGravityLevel)
                .thenComparingLong(FraudUserReportEntryDto::getConfirmedFraudCount)
                .thenComparingLong(FraudUserReportEntryDto::getFraudCount)
                .reversed())
          .collect(Collectors.toList());
    }

    public byte[] exportFraudReportCsv(
            UserEurekapp user, LocalDate from, LocalDate to, FraudAlertStatus status, Long organizationId) {
        List<FraudUserReportEntryDto> report = getFraudUserReport(user, from, to, status, organizationId);
        StringBuilder sb = new StringBuilder(
                "userId;email;fullName;fraudCount;confirmedFraudCount;pendingCount;gravityLevel;reasons;suggestedAction\n");
        for (FraudUserReportEntryDto entry : report) {
            sb.append(entry.getUserId()).append(';')
              .append(csvField(entry.getEmail())).append(';')
              .append(csvField(entry.getFullName())).append(';')
              .append(entry.getFraudCount()).append(';')
              .append(entry.getConfirmedFraudCount()).append(';')
              .append(entry.getPendingCount()).append(';')
              .append(entry.getGravityLevel()).append(';')
              .append(csvField(String.join("|", entry.getReasons()))).append(';')
              .append(csvField(entry.getSuggestedAction())).append('\n');
        }
        byte[] bom = { (byte) 0xEF, (byte) 0xBB, (byte) 0xBF };
        byte[] content = sb.toString().getBytes(StandardCharsets.UTF_8);
        byte[] result = new byte[bom.length + content.length];
        System.arraycopy(bom, 0, result, 0, bom.length);
        System.arraycopy(content, 0, result, bom.length, content.length);
        return result;
    }

    private static String csvField(String v) {
        if (v == null) return "";
        if (v.contains(";") || v.contains("\"") || v.contains("\n")) {
            return "\"" + v.replace("\"", "\"\"") + "\"";
        }
        return v;
    }

    private void validateAccess(UserEurekapp user) {
        if (user.getRole() != Role.ADMIN) {
            throw new ForbiddenException("forbidden",
                    "Solo el administrador de EurekApp puede gestionar alertas de fraude");
        }
    }

    private FraudAlertDto toDto(FraudAlert a) {
        String objectTitle = null;
        String objectDescription = null;
        if (a.getFoundObjectUUID() != null) {
            try {
                FoundObject fo = foundObjectRepository.getByUuid(a.getFoundObjectUUID());
                if (fo != null) {
                    objectTitle = fo.getTitle();
                    objectDescription = fo.getHumanDescription();
                }
            } catch (Exception ignored) {}
        }

        List<FraudClaimantDto> claimants = List.of();
        if (a.getFoundObjectUUID() != null && a.getOrganizationId() != null) {
            try {
                List<FraudClaimantDto> sfClaimants = feedbackRepository
                        .findByOrganizationIdAndFoundObjectUUIDAndWasFoundTrue(
                                a.getOrganizationId(), a.getFoundObjectUUID())
                        .stream()
                        .filter(f -> f.getUser() != null)
                        .map(f -> FraudClaimantDto.builder()
                                .userId(f.getUser().getId())
                                .email(f.getUser().getUsername())
                                .fullName(f.getUser().getFirstName() + " " + f.getUser().getLastName())
                                .build())
                        .collect(Collectors.toList());

                List<FraudClaimantDto> reclamoClaimants = reclamoRepository
                        .findByFoundObjectUUID(a.getFoundObjectUUID())
                        .stream()
                        .filter(r -> r.getOrganizationId() == null || a.getOrganizationId().equals(r.getOrganizationId()))
                        .filter(r -> r.getUser() != null)
                        .map(r -> FraudClaimantDto.builder()
                                .userId(r.getUser().getId())
                                .email(r.getUser().getUsername())
                                .fullName(r.getUser().getFirstName() + " " + r.getUser().getLastName())
                                .build())
                        .collect(Collectors.toList());

                Map<Long, FraudClaimantDto> merged = new java.util.LinkedHashMap<>();
                sfClaimants.forEach(c -> merged.put(c.getUserId(), c));
                reclamoClaimants.forEach(c -> merged.putIfAbsent(c.getUserId(), c));
                claimants = new java.util.ArrayList<>(merged.values());
            } catch (Exception ignored) {}
        }

        return FraudAlertDto.builder()
                .id(a.getId())
                .organizationId(a.getOrganizationId())
                .foundObjectUUID(a.getFoundObjectUUID())
                .foundObjectTitle(objectTitle)
                .foundObjectDescription(objectDescription)
                .suspectUserEmail(a.getSuspectUser() != null ? a.getSuspectUser().getUsername() : null)
                .suspectUserFullName(a.getSuspectUser() != null
                        ? a.getSuspectUser().getFirstName() + " " + a.getSuspectUser().getLastName()
                        : null)
                .relatedClaimants(claimants)
                .reason(a.getReason())
                .details(a.getDetails())
                .status(a.getStatus().name())
                .createdAt(a.getCreatedAt())
                .resolvedAt(a.getResolvedAt())
                .resolvedByEmail(a.getResolvedBy() != null ? a.getResolvedBy().getUsername() : null)
                .build();
    }
}
