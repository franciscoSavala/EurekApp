package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.command.UpdateClaimStatusCommand;
import com.eurekapp.backend.dto.response.ReclamoDto;
import com.eurekapp.backend.dto.response.ReclamoHistoryDto;
import com.eurekapp.backend.exception.ForbbidenException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.repository.IFraudAlertRepository;
import com.eurekapp.backend.repository.IReclamoHistoryRepository;
import com.eurekapp.backend.repository.IReclamoRepository;
import com.eurekapp.backend.repository.FoundObjectRepository;
import com.eurekapp.backend.repository.ObjectStorage;
import lombok.AllArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@AllArgsConstructor
@Service
public class ReclamoService {

    private final IReclamoRepository reclamoRepository;
    private final IReclamoHistoryRepository historyRepository;
    private final FoundObjectRepository foundObjectRepository;
    private final ObjectStorage objectStorage;
    private final IFraudAlertRepository fraudAlertRepository;

    public void createReclamo(SearchFeedback feedback, FoundObject foundObject) {
        if (feedback.getUser() == null || feedback.getFoundObjectUUID() == null
                || feedback.getOrganizationId() == null) {
            return;
        }
        // Evitar duplicados: un usuario solo puede tener un reclamo por objeto
        Optional<Reclamo> existing = reclamoRepository.findByOrganizationIdAndFoundObjectUUIDAndUser_Id(
                feedback.getOrganizationId(), feedback.getFoundObjectUUID(), feedback.getUser().getId());
        if (existing.isPresent()) {
            return;
        }
        String category = foundObject != null ? foundObject.getCategory() : null;
        Reclamo reclamo = Reclamo.builder()
                .organizationId(feedback.getOrganizationId())
                .foundObjectUUID(feedback.getFoundObjectUUID())
                .foundObjectCategory(category)
                .user(feedback.getUser())
                .comment(feedback.getComment())
                .starRating(feedback.getStarRating())
                .status(ClaimStatus.PENDIENTE)
                .createdAt(feedback.getCreatedAt())
                .updatedAt(feedback.getCreatedAt())
                .searchFeedbackId(feedback.getId())
                .build();
        reclamoRepository.save(reclamo);
    }

    public List<ReclamoDto> getReclamos(UserEurekapp user,
            ClaimStatus status, LocalDate from, LocalDate to, String category, String sortBy) {
        validateAccess(user);
        String orgId = user.getOrganization().getId().toString();

        List<Reclamo> reclamos;
        if (status != null && from != null && to != null) {
            reclamos = reclamoRepository.findByOrganizationIdAndStatusAndCreatedAtBetween(
                    orgId, status, from.atStartOfDay(), to.plusDays(1).atStartOfDay());
        } else if (status != null) {
            reclamos = reclamoRepository.findByOrganizationIdAndStatus(orgId, status);
        } else if (from != null && to != null) {
            reclamos = reclamoRepository.findByOrganizationIdAndCreatedAtBetween(
                    orgId, from.atStartOfDay(), to.plusDays(1).atStartOfDay());
        } else {
            reclamos = reclamoRepository.findByOrganizationId(orgId);
        }

        if (category != null) {
            reclamos = reclamos.stream()
                    .filter(r -> category.equalsIgnoreCase(r.getFoundObjectCategory()))
                    .collect(Collectors.toList());
        }

        List<ReclamoDto> dtos = reclamos.stream()
                .map(r -> toDto(r, false))
                .collect(Collectors.toList());

        // Ordenar
        Comparator<ReclamoDto> comparator = switch (sortBy != null ? sortBy.toLowerCase() : "date") {
            case "status" -> Comparator.comparing(ReclamoDto::getStatus);
            case "priority" -> Comparator.comparing(ReclamoDto::getConfidenceLevel).reversed();
            default -> Comparator.comparing(ReclamoDto::getCreatedAt,
                    Comparator.nullsLast(Comparator.reverseOrder()));
        };
        dtos.sort(comparator);
        return dtos;
    }

    public ReclamoDto getReclamoDetail(UserEurekapp user, Long id) {
        validateAccess(user);
        Reclamo reclamo = findAndValidateOwnership(user, id);
        return toDto(reclamo, true);
    }

    public void updateStatus(UserEurekapp user, Long id, UpdateClaimStatusCommand command) {
        validateAccess(user);
        Reclamo reclamo = findAndValidateOwnership(user, id);
        ClaimStatus newStatus;
        try {
            newStatus = ClaimStatus.valueOf(command.getNewStatus());
        } catch (IllegalArgumentException e) {
            throw new com.eurekapp.backend.exception.BadRequestException("invalid_status",
                    "Estado inválido: " + command.getNewStatus());
        }
        ReclamoHistory histEntry = ReclamoHistory.builder()
                .reclamo(reclamo)
                .previousStatus(reclamo.getStatus())
                .newStatus(newStatus)
                .changedBy(user)
                .changedAt(LocalDateTime.now())
                .note(command.getNote())
                .build();
        historyRepository.save(histEntry);
        reclamo.setStatus(newStatus);
        reclamo.setUpdatedAt(LocalDateTime.now());
        reclamoRepository.save(reclamo);
    }

    // --- helpers ---

    private void validateAccess(UserEurekapp user) {
        if (user.getRole() != Role.ENCARGADO && user.getRole() != Role.ORGANIZATION_OWNER) {
            throw new ForbbidenException("forbidden", "Solo encargados o responsables pueden acceder a los reclamos");
        }
    }

    private Reclamo findAndValidateOwnership(UserEurekapp user, Long id) {
        Reclamo reclamo = reclamoRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("reclamo_not_found", "Reclamo no encontrado"));
        String orgId = user.getOrganization().getId().toString();
        if (!orgId.equals(reclamo.getOrganizationId())) {
            throw new ForbbidenException("forbidden", "El reclamo no pertenece a tu organización");
        }
        return reclamo;
    }

    private ReclamoDto toDto(Reclamo reclamo, boolean includeDetail) {
        String orgId = reclamo.getOrganizationId();
        Long userId = reclamo.getUser() != null ? reclamo.getUser().getId() : null;

        boolean suspicious = userId != null && fraudAlertRepository
                .existsByOrganizationIdAndSuspectUser_IdAndStatus(orgId, userId, FraudAlertStatus.CONFIRMED_FRAUD);

        Integer stars = reclamo.getStarRating();
        String confidence = stars == null ? "BAJA"
                : stars >= 4 ? "ALTA"
                : stars == 3 ? "MEDIA" : "BAJA";

        ReclamoDto.ReclamoDtoBuilder builder = ReclamoDto.builder()
                .id(reclamo.getId())
                .status(reclamo.getStatus().name())
                .createdAt(reclamo.getCreatedAt())
                .updatedAt(reclamo.getUpdatedAt())
                .comment(reclamo.getComment())
                .starRating(reclamo.getStarRating())
                .confidenceLevel(confidence)
                .isSuspicious(suspicious)
                .foundObjectUUID(reclamo.getFoundObjectUUID())
                .foundObjectCategory(reclamo.getFoundObjectCategory());

        if (reclamo.getUser() != null) {
            UserEurekapp u = reclamo.getUser();
            builder.userId(u.getId())
                    .userEmail(u.getUsername())
                    .userFullName(u.getFirstName() + " " + u.getLastName());
        }

        if (includeDetail && reclamo.getFoundObjectUUID() != null) {
            FoundObject fo = foundObjectRepository.getByUuid(reclamo.getFoundObjectUUID());
            if (fo != null) {
                builder.foundObjectTitle(fo.getTitle())
                        .foundObjectHumanDescription(fo.getHumanDescription())
                        .foundObjectAiDescription(fo.getAiDescription())
                        .foundObjectDate(fo.getFoundDate())
                        .foundObjectOrganizationId(fo.getOrganizationId())
                        .foundObjectCategory(fo.getCategory() != null ? fo.getCategory() : reclamo.getFoundObjectCategory());
                if (fo.getCoordinates() != null) {
                    builder.foundObjectLatitude(fo.getCoordinates().getLatitude())
                            .foundObjectLongitude(fo.getCoordinates().getLongitude());
                }
            }
            try {
                byte[] imageBytes = objectStorage.getObjectBytes(reclamo.getFoundObjectUUID());
                if (imageBytes != null) {
                    builder.b64Json(Base64.getEncoder().encodeToString(imageBytes));
                }
            } catch (Exception e) {
                // No bloquear si falla la imagen
            }

            List<ReclamoHistoryDto> history = historyRepository
                    .findByReclamo_IdOrderByChangedAtAsc(reclamo.getId())
                    .stream()
                    .map(h -> ReclamoHistoryDto.builder()
                            .id(h.getId())
                            .previousStatus(h.getPreviousStatus() != null ? h.getPreviousStatus().name() : null)
                            .newStatus(h.getNewStatus().name())
                            .changedByEmail(h.getChangedBy() != null ? h.getChangedBy().getUsername() : null)
                            .changedAt(h.getChangedAt())
                            .note(h.getNote())
                            .build())
                    .collect(Collectors.toList());
            builder.history(history);
        }

        return builder.build();
    }
}
