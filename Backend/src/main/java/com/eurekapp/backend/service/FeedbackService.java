package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.request.SubmitFeedbackRequestDto;
import com.eurekapp.backend.dto.response.FeedbackRecordDto;
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
    private final FoundObjectRepository foundObjectRepository;

    public void submit(UserEurekapp user, SubmitFeedbackRequestDto dto) {
        FoundObject fo = null;
        if (dto.getFoundObjectUUID() != null && !dto.getFoundObjectUUID().isBlank()) {
            fo = foundObjectRepository.getByUuid(dto.getFoundObjectUUID());
        }

        String orgId = (dto.getOrganizationId() != null && !dto.getOrganizationId().isBlank())
                ? dto.getOrganizationId()
                : (fo != null ? fo.getOrganizationId() : null);

        SearchFeedback fb = SearchFeedback.builder()
                .organizationId(orgId)
                .foundObjectUUID(dto.getFoundObjectUUID())
                .starRating(dto.getStarRating())
                .wasFound(dto.getWasFound())
                .comment(dto.getComment())
                .lostObjectText(dto.getLostObjectText())
                .createdAt(LocalDateTime.now())
                .user(user)
                .build();
        feedbackRepository.save(fb);
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

    public List<FeedbackRecordDto> getRecords(UserEurekapp user, LocalDate from, LocalDate to, Boolean wasFound) {
        if (user.getRole() != Role.ORGANIZATION_OWNER) {
            throw new BadRequestException("forbidden", "Solo los responsables de organización pueden acceder a los registros de feedback");
        }
        String orgId = user.getOrganization().getId().toString();
        List<SearchFeedback> feedbacks = feedbackRepository.findByOrganizationIdAndCreatedAtBetween(
                orgId, from.atStartOfDay(), to.plusDays(1).atStartOfDay());
        if (wasFound != null) {
            feedbacks = feedbacks.stream().filter(f -> wasFound.equals(f.getWasFound())).collect(Collectors.toList());
        }
        return feedbacks.stream().map(f -> {
            String foTitle = null;
            String foDescription = null;
            if (f.getFoundObjectUUID() != null) {
                try {
                    FoundObject fo = foundObjectRepository.getByUuid(f.getFoundObjectUUID());
                    if (fo != null) {
                        foTitle = fo.getTitle();
                        foDescription = fo.getHumanDescription();
                    }
                } catch (Exception ignored) {}
            }
            if (foTitle == null) foTitle = f.getLostObjectText();
            return FeedbackRecordDto.builder()
                    .id(f.getId())
                    .organizationId(f.getOrganizationId())
                    .foundObjectUUID(f.getFoundObjectUUID())
                    .foundObjectTitle(foTitle)
                    .foundObjectDescription(foDescription)
                    .starRating(f.getStarRating())
                    .wasFound(f.getWasFound())
                    .createdAt(f.getCreatedAt())
                    .comment(f.getComment())
                    .build();
        }).collect(Collectors.toList());
    }

    public byte[] exportCsv(UserEurekapp user, LocalDate from, LocalDate to, Boolean wasFound) {
        if (user.getRole() != Role.ORGANIZATION_OWNER) {
            throw new BadRequestException("forbidden", "Solo los responsables de organización pueden exportar reportes");
        }

        String orgId = user.getOrganization().getId().toString();
        String orgName = user.getOrganization() != null ? csvField(user.getOrganization().getName()) : orgId;

        List<SearchFeedback> feedbacks = feedbackRepository.findByOrganizationIdAndCreatedAtBetween(
                orgId, from.atStartOfDay(), to.plusDays(1).atStartOfDay());
        if (wasFound != null) {
            feedbacks = feedbacks.stream().filter(f -> wasFound.equals(f.getWasFound())).collect(Collectors.toList());
        }

        StringBuilder sb = new StringBuilder("ID;Organización;Objeto encontrado;Calificación;¿Encontró el objeto?;Fecha;Comentario\n");
        for (SearchFeedback f : feedbacks) {
            String objTitle = "";
            if (f.getFoundObjectUUID() != null) {
                FoundObject fo = foundObjectRepository.getByUuid(f.getFoundObjectUUID());
                objTitle = fo != null && fo.getTitle() != null ? fo.getTitle() : "";
            }
            String fechaStr = f.getCreatedAt() != null ? f.getCreatedAt().toLocalDate().toString() : "";
            String encontroStr = Boolean.TRUE.equals(f.getWasFound()) ? "Sí" : "No";

            sb.append(f.getId()).append(';')
              .append(orgName).append(';')
              .append(csvField(objTitle)).append(';')
              .append(f.getStarRating()).append(';')
              .append(encontroStr).append(';')
              .append(fechaStr).append(';')
              .append(csvField(f.getComment())).append('\n');
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
