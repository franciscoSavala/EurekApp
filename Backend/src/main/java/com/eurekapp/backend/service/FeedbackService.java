package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.request.SubmitFeedbackRequestDto;
import com.eurekapp.backend.dto.response.FeedbackReportDto;
import com.eurekapp.backend.dto.response.FeedbackTimeSeriesPointDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.model.FoundObject;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.SearchFeedback;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.FoundObjectRepository;
import com.eurekapp.backend.repository.ISearchFeedbackRepository;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.WeekFields;
import java.util.*;
import java.util.stream.Collectors;

@AllArgsConstructor
@Service
public class FeedbackService {

    private final ISearchFeedbackRepository feedbackRepository;
    private final FraudDetectionService fraudDetectionService;
    private final ReclamoService reclamoService;
    private final FoundObjectRepository foundObjectRepository;

    public void submit(UserEurekapp user, SubmitFeedbackRequestDto dto) {
        SearchFeedback fb = SearchFeedback.builder()
                .organizationId(dto.getOrganizationId())
                .foundObjectUUID(dto.getFoundObjectUUID())
                .starRating(dto.getStarRating())
                .wasFound(dto.getWasFound())
                .comment(dto.getComment())
                .createdAt(LocalDateTime.now())
                .user(user)
                .build();
        SearchFeedback saved = feedbackRepository.save(fb);
        if (Boolean.TRUE.equals(dto.getWasFound()) && dto.getFoundObjectUUID() != null
                && dto.getOrganizationId() != null && user != null) {
            FoundObject fo = foundObjectRepository.getByUuid(dto.getFoundObjectUUID());
            reclamoService.createReclamo(saved, fo);
            fraudDetectionService.checkForFraud(dto.getOrganizationId(), dto.getFoundObjectUUID(), user);
        }
    }

    public FeedbackReportDto getReport(UserEurekapp user, LocalDate from, LocalDate to, String groupBy, Boolean wasFound) {
        if (user.getRole() != Role.ORGANIZATION_OWNER) {
            throw new BadRequestException("forbidden", "Solo los responsables de organización pueden acceder a los reportes de feedback");
        }

        String orgId = user.getOrganization().getId().toString();
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.plusDays(1).atStartOfDay();

        List<SearchFeedback> feedbacks =
                feedbackRepository.findByOrganizationIdAndCreatedAtBetween(orgId, fromDt, toDt);
        if (wasFound != null) {
            feedbacks = feedbacks.stream().filter(f -> wasFound.equals(f.getWasFound())).collect(Collectors.toList());
        }

        long successful = feedbacks.stream().filter(SearchFeedback::getWasFound).count();
        long unsuccessful = feedbacks.size() - successful;
        double avg = feedbacks.stream().mapToInt(SearchFeedback::getStarRating).average().orElse(0.0);

        Map<Integer, Long> dist = new LinkedHashMap<>();
        for (int i = 1; i <= 5; i++) {
            final int star = i;
            dist.put(star, feedbacks.stream().filter(f -> f.getStarRating() == star).count());
        }

        List<FeedbackTimeSeriesPointDto> timeSeries = buildTimeSeries(feedbacks, groupBy);

        return FeedbackReportDto.builder()
                .averageRating(Math.round(avg * 100.0) / 100.0)
                .totalFeedback((long) feedbacks.size())
                .successfulSearches(successful)
                .unsuccessfulSearches(unsuccessful)
                .starDistribution(dist)
                .timeSeries(timeSeries)
                .build();
    }

    public byte[] exportCsv(UserEurekapp user, LocalDate from, LocalDate to, Boolean wasFound) {
        if (user.getRole() != Role.ORGANIZATION_OWNER) {
            throw new BadRequestException("forbidden", "Solo los responsables de organización pueden exportar reportes");
        }

        String orgId = user.getOrganization().getId().toString();
        List<SearchFeedback> feedbacks = feedbackRepository.findByOrganizationIdAndCreatedAtBetween(
                orgId, from.atStartOfDay(), to.plusDays(1).atStartOfDay());
        if (wasFound != null) {
            feedbacks = feedbacks.stream().filter(f -> wasFound.equals(f.getWasFound())).collect(Collectors.toList());
        }

        StringBuilder sb = new StringBuilder("id,organizationId,foundObjectUUID,starRating,wasFound,createdAt,comment\n");
        for (SearchFeedback f : feedbacks) {
            sb.append(f.getId()).append(',')
              .append(f.getOrganizationId() != null ? f.getOrganizationId() : "").append(',')
              .append(f.getFoundObjectUUID() != null ? f.getFoundObjectUUID() : "").append(',')
              .append(f.getStarRating()).append(',')
              .append(f.getWasFound()).append(',')
              .append(f.getCreatedAt()).append(',')
              .append(f.getComment() != null ? f.getComment().replace(",", ";") : "").append('\n');
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    private List<FeedbackTimeSeriesPointDto> buildTimeSeries(List<SearchFeedback> feedbacks, String groupBy) {
        Map<String, List<SearchFeedback>> byPeriod = feedbacks.stream()
                .filter(f -> f.getCreatedAt() != null)
                .collect(Collectors.groupingBy(f -> getPeriodLabel(f.getCreatedAt().toLocalDate(), groupBy)));

        return new TreeSet<>(byPeriod.keySet()).stream()
                .map(label -> {
                    List<SearchFeedback> group = byPeriod.get(label);
                    long successful = group.stream().filter(SearchFeedback::getWasFound).count();
                    double avgRating = group.stream().mapToInt(SearchFeedback::getStarRating).average().orElse(0.0);
                    return FeedbackTimeSeriesPointDto.builder()
                            .label(label)
                            .avgRating(Math.round(avgRating * 100.0) / 100.0)
                            .successful(successful)
                            .unsuccessful((long) group.size() - successful)
                            .total((long) group.size())
                            .build();
                })
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
