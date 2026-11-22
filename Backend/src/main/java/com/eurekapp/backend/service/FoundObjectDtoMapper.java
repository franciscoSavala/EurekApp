package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.FoundObjectDto;
import com.eurekapp.backend.dto.response.PublicOrganizationDto;
import com.eurekapp.backend.model.FoundObject;
import com.eurekapp.backend.model.GeoCoordinates;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.ObjectStorage;
import org.springframework.stereotype.Component;

/**
 * Convierte un objeto encontrado (Weaviate) en el DTO que sale a la API. Lo usan tanto el inventario
 * y el detalle como las búsquedas.
 */
@Component
public class FoundObjectDtoMapper {

    private final ObjectStorage s3Service;
    private final IOrganizationRepository organizationRepository;
    private final OrganizationService organizationService;

    public FoundObjectDtoMapper(ObjectStorage s3Service,
                                IOrganizationRepository organizationRepository,
                                OrganizationService organizationService) {
        this.s3Service = s3Service;
        this.organizationRepository = organizationRepository;
        this.organizationService = organizationService;
    }

    public FoundObjectDto toDto(FoundObject foundObject) {
        Long objectOrganizationId = Long.parseLong(foundObject.getOrganizationId());
        Organization organization = organizationRepository.findById(objectOrganizationId)
                .orElse(null);
        PublicOrganizationDto organizationDto = organization != null ?
                organizationService.organizationToPublicDto(organization) :
                null;
        return toDto(foundObject, organizationDto);
    }

    public PublicOrganizationDto toPublicOrganization(Organization organization) {
        return organizationService.organizationToPublicDto(organization);
    }

    /** Igual que {@link #toDto(FoundObject)} con la organización ya resuelta: un listado de una sola organización no la consulta por fila. */
    public FoundObjectDto toDto(FoundObject foundObject, PublicOrganizationDto organizationDto) {
        String imageUrl = s3Service.generatePresignedUrl(foundObject.getUuid(), java.time.Duration.ofHours(1));

        GeoCoordinates coordinates = foundObject.getCoordinates();

        FoundObjectDto dto = FoundObjectDto.builder()
                .id(foundObject.getUuid())
                .title(foundObject.getTitle())
                .humanDescription(foundObject.getHumanDescription())
                .imageUrl(imageUrl)
                .score(foundObject.getScore())
                .distance(foundObject.getDistance())
                .organization(organizationDto)
                .foundDate(foundObject.getFoundDate())
                /* EU-348: las coordenadas pueden faltar —convertToFoundObject las deja en null si el
                 * objeto no las tiene guardadas— y desreferenciarlas de una tiraba un NPE que se
                 * llevaba puesto el LISTADO ENTERO, no sólo ese objeto. Es el mismo síntoma que
                 * reporta este ticket: objetos que dejan de aparecer. Un dato de ubicación ausente
                 * viaja como null y ya. */
                .latitude(coordinates != null && coordinates.getLatitude() != null
                        ? coordinates.getLatitude().floatValue() : null)
                .longitude(coordinates != null && coordinates.getLongitude() != null
                        ? coordinates.getLongitude().floatValue() : null)
                .category(foundObject.getCategory())
                .build();
        UserEurekapp finder = foundObject.getObjectFinderUser();
        if (finder != null) {
            dto.setFinderEmail(finder.getUsername());
            dto.setFinderFullName(finder.getFirstName() + " " + finder.getLastName());
            dto.setFinderRole(finder.getRole() != null ? finder.getRole().name() : null);
        }
        return dto;
    }
}
