package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.request.SubmitFeedbackRequestDto;
import com.eurekapp.backend.dto.response.FeedbackRecordDto;
import com.eurekapp.backend.dto.response.FeedbackReportDto;
import com.eurekapp.backend.dto.response.FeedbackTimeSeriesPointDto;
import com.eurekapp.backend.dto.response.OrganizationFeedbackCommentDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.FoundObject;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.OrganizationFeedback;
import com.eurekapp.backend.model.SearchFeedback;
import com.eurekapp.backend.model.UsabilityFeedback;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.FoundObjectRepository;
import com.eurekapp.backend.repository.IOrganizationFeedbackRepository;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.ISearchFeedbackRepository;
import com.eurekapp.backend.repository.IUsabilityFeedbackRepository;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.WeekFields;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@AllArgsConstructor
@Slf4j
@Service
public class FeedbackService {

    /* EU-375: los cinco aspectos de la atencion, con el nombre con el que viajan al reporte. Estan
     * en un solo lugar para que agregar o renombrar uno no obligue a tocar cinco calculos iguales. */
    private static final Map<String, Function<OrganizationFeedback, Integer>> ASPECTS =
            new LinkedHashMap<>();
    static {
        ASPECTS.put("staff_treatment", OrganizationFeedback::getStaffTreatment);
        ASPECTS.put("waiting_time", OrganizationFeedback::getWaitingTime);
        ASPECTS.put("instructions_clarity", OrganizationFeedback::getInstructionsClarity);
        ASPECTS.put("object_condition", OrganizationFeedback::getObjectCondition);
        ASPECTS.put("pickup_security", OrganizationFeedback::getPickupSecurity);
    }

    private final ISearchFeedbackRepository feedbackRepository;
    private final FoundObjectRepository foundObjectRepository;
    private final IUsabilityFeedbackRepository usabilityFeedbackRepository;
    private final IOrganizationFeedbackRepository organizationFeedbackRepository;
    private final IOrganizationRepository organizationRepository;

    /* EU-436: la precision de las coincidencias la ve el administrador, de todas las organizaciones o de
     * una. El responsable de organizacion sigue viendo solo lo suyo y el filtro que mande se ignora.
     * Devuelve el id de la organizacion a consultar, o null si el administrador pidio todas.
     * Si el administrador pide una organizacion que no existe, se rechaza el pedido. */
    private Long organizacionConsultada(UserEurekapp user, Long organizationId, String accion) {
        if (user.getRole() == Role.ADMIN) {
            if (organizationId == null) return null;
            if (!organizationRepository.existsById(organizationId)) {
                throw new BadRequestException("org_not_found", "Organization not found");
            }
            return organizationId;
        }
        if (user.getRole() == Role.ORGANIZATION_OWNER) {
            return user.getOrganization().getId();
        }
        throw new BadRequestException("forbidden", "Solo el administrador o el responsable de la organización pueden " + accion);
    }

    private List<SearchFeedback> buscarFeedback(Long orgId, LocalDateTime from, LocalDateTime to) {
        return orgId == null
                ? feedbackRepository.findByCreatedAtBetween(from, to)
                : feedbackRepository.findByOrganization_IdAndCreatedAtBetween(orgId, from, to);
    }

    private Map<Long, String> nombresDeOrganizaciones(List<SearchFeedback> feedbacks) {
        Map<Long, String> nombres = new HashMap<>();
        for (SearchFeedback f : feedbacks) {
            Organization org = f.getOrganization();
            if (org == null) continue;
            nombres.putIfAbsent(org.getId(), org.getName());
        }
        return nombres;
    }

    public void submit(UserEurekapp user, SubmitFeedbackRequestDto dto) {
        FoundObject fo = null;
        if (dto.getFoundObjectUUID() != null && !dto.getFoundObjectUUID().isBlank()) {
            fo = foundObjectRepository.getByUuid(dto.getFoundObjectUUID());
        }

        Long orgId = dto.getOrganizationId();
        if (orgId == null && fo != null && fo.getOrganizationId() != null && !fo.getOrganizationId().isBlank()) {
            orgId = Long.valueOf(fo.getOrganizationId().trim());
        }
        Organization organization = null;
        if (orgId != null) {
            organization = organizationRepository.findById(orgId)
                    .orElseThrow(() -> new BadRequestException("org_not_found", "Organization not found"));
        }

        LocalDateTime now = LocalDateTime.now();

        /* EU-372: de lo que se responde en la pantalla de resultados, a la ORGANIZACION solo le
         * corresponde el "lo encontraste?": mide que tan seguido la gente encuentra su objeto ahi.
         * Las estrellas y el comentario NO, porque en ese momento la persona todavia no fue a
         * retirar nada ni trato con nadie. */
        SearchFeedback fb = SearchFeedback.builder()
                .organization(organization)
                .foundObjectUUID(dto.getFoundObjectUUID())
                .wasFound(dto.getWasFound())
                .lostObjectText(dto.getLostObjectText())
                .createdAt(now)
                .user(user)
                .build();
        feedbackRepository.save(fb);

        /* Las estrellas y el comentario cuentan como opinion sobre la APLICACION, y van al reporte
         * del administrador. El contexto dice de donde vinieron, para poder distinguirlas de las
         * demas respuestas. */
        if (dto.getStarRating() != null && dto.getStarRating() > 0) {
            usabilityFeedbackRepository.save(UsabilityFeedback.builder()
                    .starRating(dto.getStarRating())
                    .comment(dto.getComment())
                    .context("search_results")
                    .createdAt(now)
                    .user(user)
                    .build());
        }
    }

    public FeedbackReportDto getReport(UserEurekapp user, LocalDate from, LocalDate to, String groupBy, Boolean wasFound) {
        return getReport(user, from, to, groupBy, wasFound, null);
    }

    public FeedbackReportDto getReport(UserEurekapp user, LocalDate from, LocalDate to, String groupBy, Boolean wasFound, Long organizationId) {
        Long orgId = organizacionConsultada(user, organizationId, "acceder a los reportes de feedback");
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.plusDays(1).atStartOfDay();

        List<SearchFeedback> feedbacks = buscarFeedback(orgId, fromDt, toDt);
        if (wasFound != null) {
            feedbacks = feedbacks.stream().filter(f -> wasFound.equals(f.getWasFound())).collect(Collectors.toList());
        }

        long successful = feedbacks.stream().filter(SearchFeedback::getWasFound).count();
        long unsuccessful = feedbacks.size() - successful;

        /* EU-375: la calificacion de la organizacion sale ahora de las respuestas POSTERIORES A LA
         * DEVOLUCION, que es cuando la persona ya trato con la organizacion. Se muestran promediadas
         * por aspecto: asi el responsable sabe QUE corregir, y no solo que algo anda mal. */
        // La calificacion de la atencion es del responsable de cada organizacion: el administrador no la ve aca.
        List<OrganizationFeedback> ratings = user.getRole() == Role.ORGANIZATION_OWNER
                ? organizationFeedbackRepository.findByOrganization_IdAndCreatedAtBetween(
                        user.getOrganization().getId(), fromDt, toDt)
                : List.of();

        Map<String, Double> aspectAverages = new LinkedHashMap<>();
        ASPECTS.forEach((name, valueOf) -> aspectAverages.put(name, average(ratings, valueOf)));

        List<OrganizationFeedbackCommentDto> comments = ratings.stream()
                .filter(r -> r.getComment() != null && !r.getComment().isBlank())
                .sorted(Comparator.comparing(OrganizationFeedback::getCreatedAt).reversed())
                .map(r -> OrganizationFeedbackCommentDto.builder()
                        .comment(r.getComment())
                        .createdAt(r.getCreatedAt())
                        .build())
                .collect(Collectors.toList());

        List<FeedbackTimeSeriesPointDto> timeSeries = buildTimeSeries(feedbacks, groupBy);

        return FeedbackReportDto.builder()
                .aspectAverages(aspectAverages)
                .totalRatings((long) ratings.size())
                .comments(comments)
                .totalFeedback((long) feedbacks.size())
                .successfulSearches(successful)
                .unsuccessfulSearches(unsuccessful)
                .timeSeries(timeSeries)
                .build();
    }

    private static double average(List<OrganizationFeedback> ratings,
                                  Function<OrganizationFeedback, Integer> valueOf) {
        double avg = ratings.stream()
                .map(valueOf)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .average()
                .orElse(0.0);
        return Math.round(avg * 100.0) / 100.0;
    }

    public List<FeedbackRecordDto> getRecords(UserEurekapp user, LocalDate from, LocalDate to, Boolean wasFound) {
        return getRecords(user, from, to, wasFound, null);
    }

    public List<FeedbackRecordDto> getRecords(UserEurekapp user, LocalDate from, LocalDate to, Boolean wasFound, Long organizationId) {
        Long orgId = organizacionConsultada(user, organizationId, "acceder a los registros de feedback");
        List<SearchFeedback> feedbacks = buscarFeedback(
                orgId, from.atStartOfDay(), to.plusDays(1).atStartOfDay());
        if (wasFound != null) {
            feedbacks = feedbacks.stream().filter(f -> wasFound.equals(f.getWasFound())).collect(Collectors.toList());
        }
        // Los objetos de todas las filas se piden juntos, en una sola consulta; si falla, el listado sale
        // igual y las filas quedan con el texto de respaldo.
        List<String> uuids = feedbacks.stream().map(SearchFeedback::getFoundObjectUUID)
                .filter(Objects::nonNull).distinct().collect(Collectors.toList());
        Map<String, FoundObject> objects = Map.of();
        try {
            objects = foundObjectRepository.getByUuids(uuids);
        } catch (Exception e) {
            log.warn("No se pudieron obtener los objetos {} para completar el feedback: {}",
                    uuids, e.getMessage());
        }
        final Map<String, FoundObject> objectsByUuid = objects;
        return feedbacks.stream().map(f -> {
            String foTitle = null;
            String foDescription = null;
            if (f.getFoundObjectUUID() != null) {
                FoundObject fo = objectsByUuid.get(f.getFoundObjectUUID());
                if (fo != null) {
                    foTitle = fo.getTitle();
                    foDescription = fo.getHumanDescription();
                }
            }
            if (foTitle == null) foTitle = f.getLostObjectText();
            return FeedbackRecordDto.builder()
                    .id(f.getId())
                    .organizationId(f.getOrganization() == null ? null : f.getOrganization().getId())
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
        return exportCsv(user, from, to, wasFound, null);
    }

    public byte[] exportCsv(UserEurekapp user, LocalDate from, LocalDate to, Boolean wasFound, Long organizationId) {
        Long orgId = organizacionConsultada(user, organizationId, "exportar reportes");

        List<SearchFeedback> feedbacks = buscarFeedback(
                orgId, from.atStartOfDay(), to.plusDays(1).atStartOfDay());
        Map<Long, String> nombres = user.getRole() == Role.ORGANIZATION_OWNER
                ? Map.of(orgId, String.valueOf(user.getOrganization().getName()))
                : nombresDeOrganizaciones(feedbacks);
        if (wasFound != null) {
            feedbacks = feedbacks.stream().filter(f -> wasFound.equals(f.getWasFound())).collect(Collectors.toList());
        }

        StringBuilder sb = new StringBuilder("ID;Organización;Objeto encontrado;¿Encontró el objeto?;Fecha\n");
        // Los objetos de todas las filas se piden juntos; un objeto con datos rotos hace fallar la exportación.
        Map<String, FoundObject> objectsByUuid = foundObjectRepository.getByUuidsOrFail(
                feedbacks.stream().map(SearchFeedback::getFoundObjectUUID)
                        .filter(Objects::nonNull).distinct().collect(Collectors.toList()));
        for (SearchFeedback f : feedbacks) {
            String objTitle = "";
            if (f.getFoundObjectUUID() != null) {
                FoundObject fo = objectsByUuid.get(f.getFoundObjectUUID());
                objTitle = fo != null && fo.getTitle() != null ? fo.getTitle() : "";
            }
            if (objTitle.isEmpty() && f.getLostObjectText() != null) {
                objTitle = f.getLostObjectText();
            }
            String fechaStr = f.getCreatedAt() != null ? f.getCreatedAt().toLocalDate().toString() : "";
            String encontroStr = Boolean.TRUE.equals(f.getWasFound()) ? "Sí" : "No";

            /* EU-372: la calificacion y el comentario ya no salen aca: son opinion sobre la
               aplicacion y viven en el reporte del administrador. Lo que queda es lo que si es de
               la organizacion: si la persona encontro su objeto. */
            sb.append(f.getId()).append(';')
              .append(csvField(nombres.getOrDefault(f.getOrganization() == null ? null : f.getOrganization().getId(), ""))).append(';')
              .append(csvField(objTitle)).append(';')
              .append(encontroStr).append(';')
              .append(fechaStr).append('\n');
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
                    return FeedbackTimeSeriesPointDto.builder()
                            .label(label)
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
