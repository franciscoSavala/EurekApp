package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.response.FraudAlertDto;
import com.eurekapp.backend.dto.response.FraudCaseMatchDto;
import com.eurekapp.backend.dto.response.FraudUserDto;
import com.eurekapp.backend.dto.response.FraudUserReportEntryDto;
import com.eurekapp.backend.exception.ForbiddenException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.repository.FoundObjectRepository;
import com.eurekapp.backend.repository.IFraudAlertRepository;
import com.eurekapp.backend.repository.IReturnFoundObjectRepository;
import com.eurekapp.backend.repository.IUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RequiredArgsConstructor
@Service
public class FraudDetectionService {

    private final IFraudAlertRepository alertRepository;
    private final IUserRepository userRepository;
    private final FoundObjectRepository foundObjectRepository;
    private final IReturnFoundObjectRepository returnFoundObjectRepository;
    private final FraudDetectionConfigService fraudDetectionConfigService;

    /**
     * Detección de fraude sobre devoluciones (EU-284). Se dispara al registrar una devolución.
     *
     * Las tres reglas tienen el DNI de quien retira en su clave, así que el chequeo se acota a ese
     * DNI: se trae una sola vez sus devoluciones dentro de la ventana T (cross-organización) y se
     * particiona en memoria para evaluar los tres casos. El umbral N es global a los tres.
     *
     * - Caso 1: cantidad de devoluciones del DNI ≥ N → se bloquea el DNI.
     * - Caso 2: algún (object finder ≠ null, DNI) con ≥ N → se bloquea finder + retirador(es) + DNI.
     * - Caso 3: algún (empleado, DNI) con ≥ N → se bloquea empleado + DNI.
     *
     * Como N es global y el grupo del DNI (Caso 1) contiene a los de Caso 2/3, cuando dispara el 2
     * o el 3 también dispara el 1. Si dispara más de un caso se crea UNA sola alerta que los registra
     * a todos. Dedup: si ya hay una alerta para ese DNI dentro de la ventana, no se crea otra.
     */
    public void detectFraudForReturn(ReturnFoundObject triggeringReturn) {
        if (triggeringReturn == null || triggeringReturn.getDNI() == null) return;
        String dni = triggeringReturn.getDNI();

        FraudDetectionConfig config = fraudDetectionConfigService.loadOrCreateDefault();
        int n = config.getFraudThreshold();
        int t = config.getFraudWindowDays();
        LocalDateTime windowStart = LocalDateTime.now().minusDays(t);

        List<ReturnFoundObject> returns = returnFoundObjectRepository.findByDniInWindow(dni, windowStart);

        // Caso 1 es el menos estricto (su grupo contiene a los demás): si el total del DNI no llega
        // a N, ningún caso puede llegar. Cortamos sin tocar Weaviate.
        if (returns.size() < n) return;

        // Agrupaciones acotadas al DNI:
        //  - por finder (resuelto desde Weaviate, solo finder ≠ null) → Caso 2
        //  - por empleado que entregó (ya está en la fila)            → Caso 3
        Map<Long, List<ReturnFoundObject>> byFinder = new HashMap<>();
        Map<Long, List<ReturnFoundObject>> byEmployee = new HashMap<>();
        Map<Long, UserEurekapp> usersById = new HashMap<>();

        for (ReturnFoundObject r : returns) {
            UserEurekapp employee = r.getReturnedByEmployee();
            if (employee != null && employee.getId() != null) {
                byEmployee.computeIfAbsent(employee.getId(), k -> new ArrayList<>()).add(r);
                usersById.putIfAbsent(employee.getId(), employee);
            }
            UserEurekapp finder = resolveFinder(r.getFoundObjectUUID());
            if (finder != null && finder.getId() != null) {
                byFinder.computeIfAbsent(finder.getId(), k -> new ArrayList<>()).add(r);
                usersById.putIfAbsent(finder.getId(), finder);
            }
        }

        List<FraudCaseMatch> matches = new ArrayList<>();
        Set<UserEurekapp> suspects = new LinkedHashSet<>();
        UserEurekapp employeeForAlert = null;

        // Caso 1: DNI (se bloquea el DNI; no agrega usuarios por sí solo).
        matches.add(new FraudCaseMatch(FraudCaseType.CASE_1, returns.size()));

        // Caso 2: (finder, DNI).
        for (Map.Entry<Long, List<ReturnFoundObject>> e : byFinder.entrySet()) {
            if (e.getValue().size() >= n) {
                matches.add(new FraudCaseMatch(FraudCaseType.CASE_2, e.getValue().size()));
                suspects.add(usersById.get(e.getKey()));                 // finder
                for (ReturnFoundObject r : e.getValue()) {
                    if (r.getUserEurekapp() != null) suspects.add(r.getUserEurekapp()); // retirador
                }
            }
        }

        // Caso 3: (empleado, DNI).
        for (Map.Entry<Long, List<ReturnFoundObject>> e : byEmployee.entrySet()) {
            if (e.getValue().size() >= n) {
                matches.add(new FraudCaseMatch(FraudCaseType.CASE_3, e.getValue().size()));
                UserEurekapp employee = usersById.get(e.getKey());
                suspects.add(employee);
                if (employeeForAlert == null) employeeForAlert = employee;
            }
        }

        // Dedup por DNI dentro de la ventana (X días de bloqueo = T).
        String dedupKey = "dni:" + dni;
        if (alertRepository.existsByDedupKeyAndCreatedAtAfter(dedupKey, windowStart)) return;

        String reason = matches.stream()
                .map(m -> m.getCaseType().name())
                .distinct()
                .collect(Collectors.joining(","));

        FraudAlert alert = FraudAlert.builder()
                .organizationId(null)            // alerta global / dueño de Eurekapp (detección cross-org)
                .dni(dni)
                .suspectUsers(new LinkedHashSet<>(suspects))
                .returnedByEmployee(employeeForAlert)
                .caseMatches(matches)
                .reason(reason)
                .details(buildDetails(dni, matches, employeeForAlert))
                .dedupKey(dedupKey)
                .status(FraudAlertStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .build();
        alertRepository.save(alert);
        // La notificación al dueño de Eurekapp (alerta global) se cablea en EU-287/288.
    }

    private UserEurekapp resolveFinder(String foundObjectUUID) {
        try {
            FoundObject fo = foundObjectRepository.getByUuid(foundObjectUUID);
            return fo != null ? fo.getObjectFinderUser() : null;
        } catch (Exception e) {
            return null;
        }
    }

    private String buildDetails(String dni, List<FraudCaseMatch> matches, UserEurekapp employee) {
        List<String> parts = new ArrayList<>();
        for (FraudCaseMatch m : matches) {
            switch (m.getCaseType()) {
                case CASE_1 -> parts.add("Caso 1: " + m.getMatchedCount()
                        + " devoluciones del mismo DNI");
                case CASE_2 -> parts.add("Caso 2: " + m.getMatchedCount()
                        + " devoluciones del par finder+DNI");
                case CASE_3 -> parts.add("Caso 3: " + m.getMatchedCount()
                        + " devoluciones del par empleado+DNI"
                        + (employee != null ? " (" + employee.getUsername() + ")" : ""));
            }
        }
        String details = "DNI " + dni + " — " + String.join("; ", parts) + ".";
        return details.length() > 500 ? details.substring(0, 500) : details;
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
            UserEurekapp user, LocalDate from, LocalDate to, FraudAlertStatus status) {
        if (user.getRole() != Role.ORGANIZATION_OWNER) {
            throw new ForbiddenException("forbidden",
                    "Solo el responsable de la organización puede acceder al reporte de fraude");
        }
        String orgId = user.getOrganization().getId().toString();
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.plusDays(1).atStartOfDay();

        // Paso 1: alertas filtradas (status + fecha) para determinar qué usuarios aparecen
        List<FraudAlert> filteredAlerts = status != null
                ? alertRepository.findByOrganizationIdAndStatusAndCreatedAtBetween(orgId, status, fromDt, toDt)
                : alertRepository.findByOrganizationIdAndCreatedAtBetween(orgId, fromDt, toDt);

        // Paso 2: IDs únicos de usuarios del conjunto filtrado (una alerta puede tener varios)
        Set<Long> suspectIds = filteredAlerts.stream()
                .flatMap(a -> a.getSuspectUsers().stream())
                .map(UserEurekapp::getId)
                .collect(Collectors.toSet());

        // Paso 3: para cada usuario, cargar TODOS sus casos en la org (historial completo)
        return suspectIds.stream().map(userId -> {
            List<FraudAlert> all = alertRepository
                    .findByOrganizationIdAndSuspectUsers_Id(orgId, userId);
            UserEurekapp suspect = userRepository.findById(userId).orElse(null);
            if (suspect == null) return null;

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
        }).filter(java.util.Objects::nonNull)
          .sorted(Comparator.comparingInt(FraudUserReportEntryDto::getGravityLevel)
                .thenComparingLong(FraudUserReportEntryDto::getConfirmedFraudCount)
                .thenComparingLong(FraudUserReportEntryDto::getFraudCount)
                .reversed())
          .collect(Collectors.toList());
    }

    public byte[] exportFraudReportCsv(
            UserEurekapp user, LocalDate from, LocalDate to, FraudAlertStatus status) {
        List<FraudUserReportEntryDto> report = getFraudUserReport(user, from, to, status);
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
        if (user.getRole() != Role.ORGANIZATION_OWNER && user.getRole() != Role.ENCARGADO) {
            throw new ForbiddenException("forbidden",
                    "Solo el encargado o responsable de la organización puede gestionar alertas de fraude");
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

        List<FraudUserDto> suspectUsers = a.getSuspectUsers().stream()
                .map(u -> FraudUserDto.builder()
                        .userId(u.getId())
                        .email(u.getUsername())
                        .fullName(u.getFirstName() + " " + u.getLastName())
                        .build())
                .collect(Collectors.toList());

        List<FraudCaseMatchDto> caseMatches = a.getCaseMatches() == null ? List.of()
                : a.getCaseMatches().stream()
                        .map(m -> FraudCaseMatchDto.builder()
                                .caseType(m.getCaseType().name())
                                .matchedCount(m.getMatchedCount())
                                .build())
                        .collect(Collectors.toList());

        UserEurekapp employee = a.getReturnedByEmployee();

        return FraudAlertDto.builder()
                .id(a.getId())
                .organizationId(a.getOrganizationId())
                .foundObjectUUID(a.getFoundObjectUUID())
                .foundObjectTitle(objectTitle)
                .foundObjectDescription(objectDescription)
                .dni(a.getDni())
                .suspectUsers(suspectUsers)
                .returnedByEmployeeEmail(employee != null ? employee.getUsername() : null)
                .returnedByEmployeeFullName(employee != null
                        ? employee.getFirstName() + " " + employee.getLastName()
                        : null)
                .caseMatches(caseMatches)
                .reason(a.getReason())
                .details(a.getDetails())
                .status(a.getStatus().name())
                .createdAt(a.getCreatedAt())
                .resolvedAt(a.getResolvedAt())
                .resolvedByEmail(a.getResolvedBy() != null ? a.getResolvedBy().getUsername() : null)
                .build();
    }
}
