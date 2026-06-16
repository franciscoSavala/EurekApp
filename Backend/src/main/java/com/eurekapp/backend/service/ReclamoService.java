package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.request.CreateReclamoRequestDto;
import com.eurekapp.backend.dto.response.ReclamoDto;
import com.eurekapp.backend.exception.ApiException;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.ForbiddenException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.IReclamoRepository;
import com.eurekapp.backend.repository.IRewardExclusionRepository;
import com.eurekapp.backend.repository.FoundObjectRepository;
import com.eurekapp.backend.repository.ObjectStorage;
import lombok.AllArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import org.springframework.http.HttpStatus;

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
    private final FoundObjectRepository foundObjectRepository;
    private final ObjectStorage objectStorage;
    private final IOrganizationRepository organizationRepository;
    private final IRewardExclusionRepository rewardExclusionRepository;

    public void createReclamo(SearchFeedback feedback, FoundObject foundObject, String claimDescription) {
        if (feedback.getUser() == null || feedback.getFoundObjectUUID() == null
                || feedback.getFoundObjectUUID().isBlank()) {
            return;
        }

        // Derivar organizationId del FoundObject si el feedback no lo incluye
        String orgId = (feedback.getOrganizationId() != null && !feedback.getOrganizationId().isBlank())
                ? feedback.getOrganizationId()
                : (foundObject != null ? foundObject.getOrganizationId() : null);

        if (orgId == null) {
            return;
        }

        // Evitar duplicados: un usuario solo puede tener un reclamo por objeto
        Optional<Reclamo> existing = reclamoRepository.findByOrganizationIdAndFoundObjectUUIDAndUser_Id(
                orgId, feedback.getFoundObjectUUID(), feedback.getUser().getId());
        if (existing.isPresent()) {
            return;
        }
        String category = foundObject != null ? foundObject.getCategory() : null;
        Reclamo reclamo = Reclamo.builder()
                .organizationId(orgId)
                .foundObjectUUID(feedback.getFoundObjectUUID())
                .foundObjectCategory(category)
                .user(feedback.getUser())
                .comment(feedback.getComment())
                .starRating(feedback.getStarRating())
                .claimDescription(claimDescription)
                .createdAt(feedback.getCreatedAt())
                .updatedAt(feedback.getCreatedAt())
                .searchFeedbackId(feedback.getId())
                .build();
        reclamoRepository.save(reclamo);
    }

    public ReclamoDto createReclamoForUser(UserEurekapp user, CreateReclamoRequestDto dto) {
        if (dto.getClaimDescription() == null || dto.getClaimDescription().isBlank()) {
            throw new BadRequestException("claim_description_required", "Debés describir el objeto para reclamarlo");
        }
        if (dto.getFoundObjectUUID() == null || dto.getOrganizationId() == null) {
            throw new BadRequestException("incomplete_data", "Se requiere foundObjectUUID y organizationId");
        }
        long recent = reclamoRepository.countByUserAndCreatedAtAfter(user, LocalDateTime.now().minusMinutes(1));
        if (recent >= 5) {
            throw new ApiException("rate_limit_exceeded", "Demasiados reclamos en poco tiempo", HttpStatus.TOO_MANY_REQUESTS);
        }
        Optional<Reclamo> existing = reclamoRepository.findByOrganizationIdAndFoundObjectUUIDAndUser_Id(
                dto.getOrganizationId(), dto.getFoundObjectUUID(), user.getId());
        if (existing.isPresent()) {
            return toDto(existing.get(), false);
        }
        FoundObject fo = foundObjectRepository.getByUuid(dto.getFoundObjectUUID());
        String category = fo != null ? fo.getCategory() : null;
        LocalDateTime now = LocalDateTime.now();
        Reclamo reclamo = Reclamo.builder()
                .organizationId(dto.getOrganizationId())
                .foundObjectUUID(dto.getFoundObjectUUID())
                .foundObjectCategory(category)
                .user(user)
                .claimDescription(dto.getClaimDescription())
                .createdAt(now)
                .updatedAt(now)
                .build();
        Reclamo saved = reclamoRepository.save(reclamo);
        return toDto(saved, false);
    }

    public List<ReclamoDto> getReclamos(UserEurekapp user,
            LocalDate from, LocalDate to, String category, String sortBy) {
        validateAccess(user);
        String orgId = user.getOrganization().getId().toString();

        List<Reclamo> reclamos;
        if (from != null && to != null) {
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

    public List<ReclamoDto> getMyReclamos(UserEurekapp user) {
        List<Reclamo> reclamos = reclamoRepository.findByUser_Id(user.getId());
        return reclamos.stream()
                .map(r -> {
                    ReclamoDto dto = toDto(r, false);
                    if (r.getFoundObjectUUID() != null) {
                        FoundObject fo = foundObjectRepository.getByUuid(r.getFoundObjectUUID());
                        if (fo != null) {
                            dto.setFoundObjectTitle(fo.getTitle());
                            dto.setFoundObjectHumanDescription(fo.getHumanDescription());
                        }
                    }
                    return dto;
                })
                .sorted(Comparator.comparing(ReclamoDto::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());
    }

    public ReclamoDto getMyReclamoDetail(UserEurekapp user, Long id) {
        Reclamo reclamo = reclamoRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("reclamo_not_found", "Reclamo no encontrado"));
        if (reclamo.getUser() == null || !reclamo.getUser().getId().equals(user.getId())) {
            throw new ForbiddenException("forbidden", "No tenés permiso para ver este reclamo");
        }
        return toDto(reclamo, true, false);
    }

    // --- helpers ---

    private void validateAccess(UserEurekapp user) {
        if (user.getRole() != Role.ENCARGADO && user.getRole() != Role.ORGANIZATION_OWNER) {
            throw new ForbiddenException("forbidden", "Solo encargados o responsables pueden acceder a los reclamos");
        }
    }

    private Reclamo findAndValidateOwnership(UserEurekapp user, Long id) {
        Reclamo reclamo = reclamoRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("reclamo_not_found", "Reclamo no encontrado"));
        String orgId = user.getOrganization().getId().toString();
        if (!orgId.equals(reclamo.getOrganizationId())) {
            throw new ForbiddenException("forbidden", "El reclamo no pertenece a tu organización");
        }
        return reclamo;
    }

    private ReclamoDto toDto(Reclamo reclamo, boolean includeDetail) {
        return toDto(reclamo, includeDetail, true);
    }

    private ReclamoDto toDto(Reclamo reclamo, boolean includeDetail, boolean includeInternalInfo) {
        Integer stars = reclamo.getStarRating();
        String confidence = stars == null ? "BAJA"
                : stars >= 4 ? "ALTA"
                : stars == 3 ? "MEDIA" : "BAJA";

        ReclamoDto.ReclamoDtoBuilder builder = ReclamoDto.builder()
                .id(reclamo.getId())
                .createdAt(reclamo.getCreatedAt())
                .updatedAt(reclamo.getUpdatedAt())
                .comment(reclamo.getComment())
                .claimDescription(reclamo.getClaimDescription())
                .starRating(reclamo.getStarRating())
                .confidenceLevel(confidence)
                .foundObjectUUID(reclamo.getFoundObjectUUID())
                .foundObjectCategory(reclamo.getFoundObjectCategory());

        if (reclamo.getUser() != null) {
            UserEurekapp u = reclamo.getUser();
            builder.userId(u.getId())
                    .userEmail(u.getUsername())
                    .userFullName(u.getFirstName() + " " + u.getLastName());
        }

        if (reclamo.getFoundObjectUUID() != null) {
            FoundObject fo = foundObjectRepository.getByUuid(reclamo.getFoundObjectUUID());
            if (fo != null) {
                builder.foundObjectTitle(fo.getTitle());
                if (includeDetail) {
                    builder.foundObjectHumanDescription(fo.getHumanDescription())
                            .foundObjectAiDescription(fo.getAiDescription())
                            .foundObjectDate(fo.getFoundDate())
                            .foundObjectOrganizationId(fo.getOrganizationId())
                            .foundObjectCategory(fo.getCategory() != null ? fo.getCategory() : reclamo.getFoundObjectCategory());
                    if (fo.getCoordinates() != null) {
                        builder.foundObjectLatitude(fo.getCoordinates().getLatitude())
                                .foundObjectLongitude(fo.getCoordinates().getLongitude());
                    }
                    String effectiveOrgId = fo.getOrganizationId() != null
                            ? fo.getOrganizationId()
                            : reclamo.getOrganizationId();
                    if (effectiveOrgId != null) {
                        try {
                            organizationRepository.findById(Long.parseLong(effectiveOrgId))
                                    .ifPresent(org -> builder
                                            .foundObjectOrganizationName(org.getName())
                                            .foundObjectStreet(org.getStreet())
                                            .foundObjectStreetNumber(org.getStreetNumber()));
                        } catch (NumberFormatException ignored) {}
                    }
                    if (includeInternalInfo && fo.getObjectFinderUser() != null) {
                        UserEurekapp finder = fo.getObjectFinderUser();
                        builder.finderEmail(finder.getUsername())
                                .finderFullName(finder.getFirstName() + " " + finder.getLastName())
                                .finderRole(finder.getRole() != null ? finder.getRole().name() : null);
                        rewardExclusionRepository.findByFoundObjectUUID(reclamo.getFoundObjectUUID())
                                .ifPresent(excl -> builder
                                        .rewardExcluded(true)
                                        .rewardExclusionReason("El usuario que encontró el objeto no puede recibir recompensas de puntos por ser un miembro activo de la organización"));
                    }
                }
            }
            if (includeDetail) {
                try {
                    byte[] imageBytes = objectStorage.getObjectBytes(reclamo.getFoundObjectUUID());
                    if (imageBytes != null) {
                        builder.b64Json(Base64.getEncoder().encodeToString(imageBytes));
                    }
                } catch (Exception e) {
                    // No bloquear si falla la imagen
                }
            }
        }

        if (reclamo.getFoundObjectUUID() == null && reclamo.getClaimDescription() != null) {
            builder.foundObjectTitle(reclamo.getClaimDescription());
        }

        return builder.build();
    }
}
