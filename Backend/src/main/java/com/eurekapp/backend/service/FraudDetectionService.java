package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.response.FraudAlertDto;
import com.eurekapp.backend.dto.response.FraudCaseMatchDto;
import com.eurekapp.backend.dto.response.FraudDniReportEntryDto;
import com.eurekapp.backend.dto.response.FraudUserDto;
import com.eurekapp.backend.dto.response.FraudUserReportEntryDto;
import com.eurekapp.backend.exception.BadRequestException;
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
    private final FraudBlockService fraudBlockService;
    private final InAppNotificationService inAppNotificationService;

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
                .status(FraudAlertStatus.ACTIVE)
                .createdAt(LocalDateTime.now())
                .build();
        alertRepository.save(alert);

        // Bloqueo automático (EU-286): al persistir la alerta se crean los bloqueos del DNI y de cada
        // usuario sospechoso, vigentes durante la duración de bloqueo configurada (≠ ventana T).
        fraudBlockService.createBlocksForAlert(alert, config.getBlockDurationDays());

        // Si hay un empleado involucrado (Caso 3), se avisa al dueño de su organización (EU-288). La
        // gestión del fraude sigue siendo del dueño de Eurekapp; el responsable de la org solo se entera.
        notifyOrganizationOwnerIfEmployeeInvolved(employeeForAlert);
    }

    private void notifyOrganizationOwnerIfEmployeeInvolved(UserEurekapp employee) {
        if (employee == null || employee.getOrganization() == null) return;
        userRepository.findByOrganizationAndRole(employee.getOrganization(), Role.ORGANIZATION_OWNER)
                .stream().findFirst()
                .ifPresent(owner -> inAppNotificationService.createNotification(
                        owner,
                        "Empleado involucrado en una alerta de fraude",
                        "Se generó una alerta de fraude en la que aparece involucrado "
                                + employee.getFirstName() + " " + employee.getLastName()
                                + ", empleado de tu organización. La alerta la gestiona el equipo de Eurekapp.",
                        "FRAUD_EMPLOYEE_INVOLVED",
                        null));
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
        return alertRepository.findAllByOrderByCreatedAtDesc()
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    public FraudAlertDto getAlertDetail(Long alertId, UserEurekapp user) {
        validateAccess(user);
        FraudAlert alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new NotFoundException("fraud_alert_not_found", "Alerta no encontrada"));
        return toDto(alert);
    }

    /**
     * Marca una alerta como falsa alarma (EU-288). Es la única acción humana posible sobre una alerta:
     * en el modelo de 2 estados no existe "confirmar fraude" (la alerta ya bloqueó al crearse). Levanta
     * el bloqueo asociado y avisa a los usuarios que quedaron efectivamente desbloqueados (EU-287).
     */
    public void markFalseAlarm(Long alertId, UserEurekapp user) {
        validateAccess(user);
        FraudAlert alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new NotFoundException("fraud_alert_not_found", "Alerta no encontrada"));
        if (alert.getStatus() != FraudAlertStatus.ACTIVE) {
            throw new BadRequestException("alert_not_active",
                    "La alerta ya fue marcada como falsa alarma.");
        }
        alert.setStatus(FraudAlertStatus.FALSE_POSITIVE);
        alert.setResolvedAt(LocalDateTime.now());
        alert.setResolvedBy(user);
        alertRepository.save(alert);

        // Se levanta el bloqueo creado por esta alerta y se avisa a los usuarios que quedaron
        // efectivamente desbloqueados (los que no siguen bloqueados por otra alerta).
        for (UserEurekapp unblocked : fraudBlockService.liftBlocksForAlert(alert)) {
            inAppNotificationService.createNotification(
                    unblocked,
                    "Se levantó tu bloqueo",
                    "Una alerta de fraude que te afectaba fue marcada como falsa alarma. "
                            + "Tu cuenta ya no está bloqueada por ese motivo.",
                    "FRAUD_BLOCK_LIFTED",
                    null);
        }
    }

    /**
     * Reporte de fraude global agrupado por usuario registrado (EU-288). Solo ADMIN (dueño de
     * Eurekapp). El rango de fechas determina qué usuarios aparecen y los conteos del rango; el
     * acumulado histórico ({@code historicalCount}) y el historial completo de incidentes se traen
     * aparte para la marca de reincidencia y el drill-down, sin contaminar los números del rango.
     */
    public List<FraudUserReportEntryDto> getFraudUserReport(
            UserEurekapp user, LocalDate from, LocalDate to, FraudAlertStatus status) {
        List<FraudAlert> filtered = loadFilteredAlerts(user, from, to, status);

        // Agrupa el conjunto del rango por usuario sospechoso (una alerta puede señalar a varios).
        Map<Long, List<FraudAlert>> inRangeByUser = new HashMap<>();
        for (FraudAlert a : filtered) {
            for (UserEurekapp u : a.getSuspectUsers()) {
                if (u != null && u.getId() != null) {
                    inRangeByUser.computeIfAbsent(u.getId(), k -> new ArrayList<>()).add(a);
                }
            }
        }

        return inRangeByUser.entrySet().stream().map(e -> {
            UserEurekapp suspect = userRepository.findById(e.getKey()).orElse(null);
            if (suspect == null) return null;
            List<FraudAlert> inRange = e.getValue();
            List<FraudAlert> all = alertRepository.findBySuspectUsers_Id(e.getKey()); // histórico completo

            return FraudUserReportEntryDto.builder()
                    .userId(suspect.getId())
                    .email(suspect.getUsername())
                    .fullName(suspect.getFirstName() + " " + suspect.getLastName())
                    .fraudCount(inRange.size())
                    .activeCount(countByStatus(inRange, FraudAlertStatus.ACTIVE))
                    .falsePositiveCount(countByStatus(inRange, FraudAlertStatus.FALSE_POSITIVE))
                    .historicalCount(all.size())
                    .reasons(distinctReasons(inRange))
                    .incidents(incidentsDesc(all))
                    .build();
        }).filter(java.util.Objects::nonNull)
          .sorted(Comparator.comparingLong(FraudUserReportEntryDto::getActiveCount)
                .thenComparingLong(FraudUserReportEntryDto::getFraudCount)
                .reversed())
          .collect(Collectors.toList());
    }

    /**
     * Reporte de fraude global agrupado por DNI (EU-288). Mismos criterios que el de usuario, pero
     * cada fila es un DNI (sin nombre ni email): el modelo nuevo gira alrededor del DNI de quien
     * retira, y mucha de esa gente no tiene cuenta.
     */
    public List<FraudDniReportEntryDto> getFraudDniReport(
            UserEurekapp user, LocalDate from, LocalDate to, FraudAlertStatus status) {
        List<FraudAlert> filtered = loadFilteredAlerts(user, from, to, status);

        Map<String, List<FraudAlert>> inRangeByDni = filtered.stream()
                .filter(a -> a.getDni() != null)
                .collect(Collectors.groupingBy(FraudAlert::getDni));

        return inRangeByDni.entrySet().stream().map(e -> {
            String dni = e.getKey();
            List<FraudAlert> inRange = e.getValue();
            List<FraudAlert> all = alertRepository.findByDni(dni); // histórico completo del DNI

            return FraudDniReportEntryDto.builder()
                    .dni(dni)
                    .fraudCount(inRange.size())
                    .activeCount(countByStatus(inRange, FraudAlertStatus.ACTIVE))
                    .falsePositiveCount(countByStatus(inRange, FraudAlertStatus.FALSE_POSITIVE))
                    .historicalCount(all.size())
                    .reasons(distinctReasons(inRange))
                    .incidents(incidentsDesc(all))
                    .build();
        }).sorted(Comparator.comparingLong(FraudDniReportEntryDto::getActiveCount)
                .thenComparingLong(FraudDniReportEntryDto::getFraudCount)
                .reversed())
          .collect(Collectors.toList());
    }

    // Carga las alertas del rango (+ status opcional) que determinan quiénes entran al reporte.
    // Solo ADMIN: el fraude es global y lo gestiona el dueño de Eurekapp.
    private List<FraudAlert> loadFilteredAlerts(
            UserEurekapp user, LocalDate from, LocalDate to, FraudAlertStatus status) {
        validateAccess(user);
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.plusDays(1).atStartOfDay();
        return status != null
                ? alertRepository.findByStatusAndCreatedAtBetween(status, fromDt, toDt)
                : alertRepository.findByCreatedAtBetween(fromDt, toDt);
    }

    private long countByStatus(List<FraudAlert> alerts, FraudAlertStatus st) {
        return alerts.stream().filter(a -> a.getStatus() == st).count();
    }

    private List<String> distinctReasons(List<FraudAlert> alerts) {
        return alerts.stream().map(FraudAlert::getReason)
                .filter(java.util.Objects::nonNull).distinct().collect(Collectors.toList());
    }

    private List<FraudAlertDto> incidentsDesc(List<FraudAlert> alerts) {
        return alerts.stream()
                .sorted(Comparator.comparing(FraudAlert::getCreatedAt).reversed())
                .map(this::toDto).collect(Collectors.toList());
    }

    // El motivo crudo ("CASE_1,CASE_3") se pasa a lenguaje llano para CSV/PDF (las pantallas hacen lo
    // propio del lado del front). La conversión vive en FraudCaseType para no duplicar los textos.
    private String humanReasonsField(List<String> rawReasons) {
        return rawReasons.stream().map(FraudCaseType::humanizeReason)
                .filter(s -> !s.isEmpty()).collect(Collectors.joining(" | "));
    }

    public byte[] exportFraudReportCsv(
            UserEurekapp user, LocalDate from, LocalDate to, FraudAlertStatus status, String groupBy) {
        StringBuilder sb = new StringBuilder();
        if ("DNI".equalsIgnoreCase(groupBy)) {
            sb.append("dni;fraudCount;activeCount;falsePositiveCount;historicalCount;reasons\n");
            for (FraudDniReportEntryDto e : getFraudDniReport(user, from, to, status)) {
                sb.append(csvField(e.getDni())).append(';')
                  .append(e.getFraudCount()).append(';')
                  .append(e.getActiveCount()).append(';')
                  .append(e.getFalsePositiveCount()).append(';')
                  .append(e.getHistoricalCount()).append(';')
                  .append(csvField(humanReasonsField(e.getReasons()))).append('\n');
            }
        } else {
            sb.append("userId;email;fullName;fraudCount;activeCount;falsePositiveCount;historicalCount;reasons\n");
            for (FraudUserReportEntryDto e : getFraudUserReport(user, from, to, status)) {
                sb.append(e.getUserId()).append(';')
                  .append(csvField(e.getEmail())).append(';')
                  .append(csvField(e.getFullName())).append(';')
                  .append(e.getFraudCount()).append(';')
                  .append(e.getActiveCount()).append(';')
                  .append(e.getFalsePositiveCount()).append(';')
                  .append(e.getHistoricalCount()).append(';')
                  .append(csvField(humanReasonsField(e.getReasons()))).append('\n');
            }
        }
        byte[] bom = { (byte) 0xEF, (byte) 0xBB, (byte) 0xBF };
        byte[] content = sb.toString().getBytes(StandardCharsets.UTF_8);
        byte[] result = new byte[bom.length + content.length];
        System.arraycopy(bom, 0, result, 0, bom.length);
        System.arraycopy(content, 0, result, bom.length, content.length);
        return result;
    }

    private String humanReasonsField(List<String> rawReasons) {
        return rawReasons.stream().map(this::humanizeReason)
                .filter(s -> !s.isEmpty()).collect(Collectors.joining(" | "));
    }

    private static String csvField(String v) {
        if (v == null) return "";
        if (v.contains(";") || v.contains("\"") || v.contains("\n")) {
            return "\"" + v.replace("\"", "\"\"") + "\"";
        }
        return v;
    }

    private void validateAccess(UserEurekapp user) {
        // Las alertas de fraude son globales (cross-organización) y las gestiona el dueño de Eurekapp (EU-287).
        if (user.getRole() != Role.ADMIN) {
            throw new ForbiddenException("forbidden",
                    "Solo el dueño de Eurekapp puede gestionar alertas de fraude");
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
