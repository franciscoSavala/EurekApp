package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.response.ReportsResponseDto;
import com.eurekapp.backend.dto.response.TimeSeriesPointDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.repository.*;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.WeekFields;
import java.util.*;
import java.util.stream.Collectors;

@AllArgsConstructor
@Service
public class ReportsService {

    private final FoundObjectRepository foundObjectRepository;
    private final LostObjectRepository lostObjectRepository;
    private final IReturnFoundObjectRepository returnFoundObjectRepository;
    private final IUserRepository userRepository;

    public ReportsResponseDto getReports(UserEurekapp user, LocalDate from, LocalDate to, String groupBy) {
        if (user.getRole() != Role.ORGANIZATION_OWNER) {
            throw new BadRequestException("forbidden", "Solo los responsables de organización pueden acceder a los reportes");
        }

        String orgId = user.getOrganization().getId().toString();
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.plusDays(1).atStartOfDay();

        // Obtener FoundObjects del org en el rango
        List<FoundObject> foundObjects = foundObjectRepository.query(null, orgId, null, fromDt, toDt, null);

        // Obtener LostObjects del org en el rango
        List<LostObject> lostObjects = lostObjectRepository.query(null, null, orgId, fromDt, toDt);

        // Obtener ReturnFoundObjects del org en el rango
        List<String> foundObjectUUIDs = foundObjects.stream()
                .map(FoundObject::getUuid)
                .collect(Collectors.toList());
        List<ReturnFoundObject> returnedObjects = foundObjectUUIDs.isEmpty()
                ? Collections.emptyList()
                : returnFoundObjectRepository.findByFoundObjectUUIDInAndDatetimeOfReturnBetween(foundObjectUUIDs, fromDt, toDt);

        // Contar usuarios activos del org
        long activeUsers = userRepository.findByOrganizationAndRole(user.getOrganization(), Role.ORGANIZATION_OWNER).size()
                + userRepository.findByOrganizationAndRole(user.getOrganization(), Role.ORGANIZATION_EMPLOYEE).size();

        // Construir time series
        List<TimeSeriesPointDto> timeSeries = buildTimeSeries(foundObjects, lostObjects, returnedObjects, groupBy, from, to);

        return ReportsResponseDto.builder()
                .foundObjects((long) foundObjects.size())
                .lostObjects((long) lostObjects.size())
                .returnedObjects((long) returnedObjects.size())
                .activeUsers(activeUsers)
                .timeSeries(timeSeries)
                .build();
    }

    private List<TimeSeriesPointDto> buildTimeSeries(
            List<FoundObject> foundObjects,
            List<LostObject> lostObjects,
            List<ReturnFoundObject> returnedObjects,
            String groupBy,
            LocalDate from,
            LocalDate to) {

        // Agrupar FoundObjects por período
        Map<String, Long> foundByPeriod = foundObjects.stream()
                .filter(fo -> fo.getFoundDate() != null)
                .collect(Collectors.groupingBy(
                        fo -> getPeriodLabel(fo.getFoundDate().toLocalDate(), groupBy),
                        Collectors.counting()
                ));

        // Agrupar LostObjects por período
        Map<String, Long> lostByPeriod = lostObjects.stream()
                .filter(lo -> lo.getLostDate() != null)
                .collect(Collectors.groupingBy(
                        lo -> getPeriodLabel(lo.getLostDate().toLocalDate(), groupBy),
                        Collectors.counting()
                ));

        // Agrupar ReturnedObjects por período
        Map<String, Long> returnedByPeriod = returnedObjects.stream()
                .filter(ro -> ro.getDatetimeOfReturn() != null)
                .collect(Collectors.groupingBy(
                        ro -> getPeriodLabel(ro.getDatetimeOfReturn().toLocalDate(), groupBy),
                        Collectors.counting()
                ));

        // Unir todos los labels presentes
        Set<String> allLabels = new TreeSet<>();
        allLabels.addAll(foundByPeriod.keySet());
        allLabels.addAll(lostByPeriod.keySet());
        allLabels.addAll(returnedByPeriod.keySet());

        return allLabels.stream()
                .map(label -> TimeSeriesPointDto.builder()
                        .label(label)
                        .foundObjects(foundByPeriod.getOrDefault(label, 0L))
                        .lostObjects(lostByPeriod.getOrDefault(label, 0L))
                        .returnedObjects(returnedByPeriod.getOrDefault(label, 0L))
                        .build())
                .collect(Collectors.toList());
    }

    private String getPeriodLabel(LocalDate date, String groupBy) {
        return switch (groupBy.toUpperCase()) {
            case "WEEK" -> date.with(WeekFields.ISO.dayOfWeek(), 1).toString();
            case "MONTH" -> date.getYear() + "-" + String.format("%02d", date.getMonthValue());
            default -> date.toString(); // DAY
        };
    }
}
