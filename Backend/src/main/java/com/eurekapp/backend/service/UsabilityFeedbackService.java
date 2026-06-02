package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.request.SubmitUsabilityFeedbackRequestDto;
import com.eurekapp.backend.dto.response.UsabilityFeedbackRecordDto;
import com.eurekapp.backend.dto.response.UsabilityFeedbackReportDto;
import com.eurekapp.backend.dto.response.UsabilityTimeSeriesPointDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UsabilityFeedback;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IUsabilityFeedbackRepository;
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
public class UsabilityFeedbackService {

    private final IUsabilityFeedbackRepository repository;

    public void submit(UserEurekapp user, SubmitUsabilityFeedbackRequestDto dto) {
        String aspectsStr = (dto.getAspects() != null && !dto.getAspects().isEmpty())
                ? String.join(",", dto.getAspects())
                : null;
        UsabilityFeedback fb = UsabilityFeedback.builder()
                .starRating(dto.getStarRating())
                .aspects(aspectsStr)
                .comment(dto.getComment())
                .context(dto.getContext())
                .createdAt(LocalDateTime.now())
                .user(user)
                .build();
        repository.save(fb);
    }

    public UsabilityFeedbackReportDto getReport(UserEurekapp user, LocalDate from, LocalDate to, String groupBy) {
        if (user.getRole() != Role.ORGANIZATION_OWNER) {
            throw new BadRequestException("forbidden", "Solo los responsables de organización pueden acceder a los reportes de feedback de usabilidad");
        }

        Long orgId = user.getOrganization().getId();
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.plusDays(1).atStartOfDay();

        List<UsabilityFeedback> feedbacks = repository.findByUser_Organization_IdAndCreatedAtBetween(orgId, fromDt, toDt);

        double avg = feedbacks.stream().mapToInt(UsabilityFeedback::getStarRating).average().orElse(0.0);

        Map<Integer, Long> starDist = new LinkedHashMap<>();
        for (int i = 1; i <= 5; i++) {
            final int star = i;
            starDist.put(star, feedbacks.stream().filter(f -> f.getStarRating() == star).count());
        }

        Map<String, Long> aspectDist = new LinkedHashMap<>();
        for (UsabilityFeedback f : feedbacks) {
            if (f.getAspects() != null && !f.getAspects().isBlank()) {
                for (String aspect : f.getAspects().split(",")) {
                    String key = aspect.trim();
                    if (!key.isEmpty()) {
                        aspectDist.merge(key, 1L, Long::sum);
                    }
                }
            }
        }

        List<UsabilityTimeSeriesPointDto> timeSeries = buildTimeSeries(feedbacks, groupBy);

        return UsabilityFeedbackReportDto.builder()
                .averageRating(Math.round(avg * 100.0) / 100.0)
                .totalFeedback((long) feedbacks.size())
                .starDistribution(starDist)
                .aspectDistribution(aspectDist)
                .timeSeries(timeSeries)
                .build();
    }

    public List<UsabilityFeedbackRecordDto> getRecords(UserEurekapp user, LocalDate from, LocalDate to) {
        if (user.getRole() != Role.ORGANIZATION_OWNER) {
            throw new BadRequestException("forbidden", "Solo los responsables de organización pueden acceder a los registros de feedback de usabilidad");
        }

        Long orgId = user.getOrganization().getId();
        List<UsabilityFeedback> feedbacks = repository.findByUser_Organization_IdAndCreatedAtBetween(
                orgId, from.atStartOfDay(), to.plusDays(1).atStartOfDay());

        return feedbacks.stream().map(f -> UsabilityFeedbackRecordDto.builder()
                .id(f.getId())
                .starRating(f.getStarRating())
                .aspects(f.getAspects() != null && !f.getAspects().isBlank()
                        ? Arrays.asList(f.getAspects().split(","))
                        : List.of())
                .comment(f.getComment())
                .context(f.getContext())
                .createdAt(f.getCreatedAt())
                .build()).collect(Collectors.toList());
    }

    public byte[] exportCsv(UserEurekapp user, LocalDate from, LocalDate to) {
        if (user.getRole() != Role.ORGANIZATION_OWNER) {
            throw new BadRequestException("forbidden", "Solo los responsables de organización pueden exportar reportes de usabilidad");
        }

        Long orgId = user.getOrganization().getId();
        List<UsabilityFeedback> feedbacks = repository.findByUser_Organization_IdAndCreatedAtBetween(
                orgId, from.atStartOfDay(), to.plusDays(1).atStartOfDay());

        StringBuilder sb = new StringBuilder("id;starRating;aspects;comment;context;createdAt\n");
        for (UsabilityFeedback f : feedbacks) {
            sb.append(f.getId()).append(';')
              .append(f.getStarRating()).append(';')
              .append(csvField(f.getAspects())).append(';')
              .append(csvField(f.getComment())).append(';')
              .append(f.getContext() != null ? f.getContext() : "").append(';')
              .append(f.getCreatedAt()).append('\n');
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

    private List<UsabilityTimeSeriesPointDto> buildTimeSeries(List<UsabilityFeedback> feedbacks, String groupBy) {
        Map<String, List<UsabilityFeedback>> byPeriod = feedbacks.stream()
                .filter(f -> f.getCreatedAt() != null)
                .collect(Collectors.groupingBy(f -> getPeriodLabel(f.getCreatedAt().toLocalDate(), groupBy)));

        return new TreeSet<>(byPeriod.keySet()).stream()
                .map(label -> {
                    List<UsabilityFeedback> group = byPeriod.get(label);
                    double avgRating = group.stream().mapToInt(UsabilityFeedback::getStarRating).average().orElse(0.0);
                    return UsabilityTimeSeriesPointDto.builder()
                            .label(label)
                            .avgRating(Math.round(avgRating * 100.0) / 100.0)
                            .total((long) group.size())
                            .build();
                })
                .collect(Collectors.toList());
    }

    private String getPeriodLabel(LocalDate date, String groupBy) {
        return switch (groupBy.toUpperCase()) {
            case "WEEK" -> date.with(WeekFields.ISO.dayOfWeek(), 1).toString();
            case "MONTH" -> date.getYear() + "-" + String.format("%02d", date.getMonthValue());
            default -> date.toString();
        };
    }
}
