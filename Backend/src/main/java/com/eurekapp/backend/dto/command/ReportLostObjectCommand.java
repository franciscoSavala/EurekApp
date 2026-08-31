package com.eurekapp.backend.dto.command;

import com.eurekapp.backend.model.GeoCoordinates;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import lombok.Builder;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import org.springframework.web.multipart.MultipartFile;
import java.time.LocalDateTime;

@Getter
@Setter
@Data
@Builder
public class ReportLostObjectCommand {
    // EU-324: foto de la búsqueda. El front la reenvía al GUARDAR la búsqueda (stateless); se
    // vectoriza con CLIP y se clasifica por IA, y se sube a S3 sólo aquí (al guardar).
    private MultipartFile image;
    @JsonProperty("description")
    private String description;
    @JsonProperty("username")
    private String username;
    @JsonProperty("lost_date")
    private LocalDateTime lostDate;
    @JsonProperty("coordinates")
    private GeoCoordinates geoCoordinates;
    @JsonProperty("organization_id")
    private String organizationId;
    // EU-347: UUID del objeto encontrado que el usuario reconoció como suyo durante la búsqueda en
    // vivo. Si viene, la búsqueda nace ya en PENDING_PICKUP en lugar de ACTIVE: guardarla y marcarla
    // como reclamada son el mismo hecho, y separarlos dejaría una ventana diciendo "Buscando".
    @JsonProperty("matched_object_uuid")
    private String matchedObjectUuid;
}
