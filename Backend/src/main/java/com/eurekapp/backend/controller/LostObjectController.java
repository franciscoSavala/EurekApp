package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.command.ReportLostObjectCommand;
import com.eurekapp.backend.dto.request.CloseLostObjectRequestDto;
import com.eurekapp.backend.dto.request.PendingPickupRequestDto;
import com.eurekapp.backend.dto.response.LostObjectResponseDto;
import com.eurekapp.backend.model.GeoCoordinates;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.service.LostObjectService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/lost-objects")
@CrossOrigin("*")
@Tag(name = "Objetos Perdidos", description = "Reporte de búsquedas abiertas de objetos perdidos")
@SecurityRequirement(name = "bearerAuth")
public class LostObjectController {

    @Autowired
    private LostObjectService lostObjectService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('USER')")
    @Operation(summary = "Reportar objeto perdido",
            description = "Guarda una búsqueda abierta de un objeto perdido. La descripción es obligatoria y la "
                    + "foto es OPCIONAL (EU-326): si viene, se vectoriza (CLIP) y se sube a S3 al guardar; si no "
                    + "viene, la búsqueda queda sólo con el vector textual, lo que la hace más débil para el "
                    + "aviso automático. Adjuntar una foto es lo recomendable. La categoría se deduce del TEXTO "
                    + "con precedencia sobre la foto (EU-337); si ninguna señal alcanza, queda sin categoría. "
                    + "EU-347: si viene 'matched_object_uuid', la búsqueda nace en PENDING_PICKUP ('Por "
                    + "retirar') apuntando a ese objeto, en lugar de ACTIVE. Es el caso de la búsqueda en "
                    + "vivo: el usuario reconoció una coincidencia como suya sin haber guardado la búsqueda "
                    + "antes, así que se le guarda sola y ya con el objeto reclamado.")
    public ResponseEntity<Void> reportLostObject(
            @AuthenticationPrincipal UserEurekapp user,
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam("description") String description,
            @RequestParam(value = "lost_date", required = false) LocalDateTime lostDate,
            @RequestParam(value = "latitude", required = false) Double latitude,
            @RequestParam(value = "longitude", required = false) Double longitude,
            @RequestParam(value = "organization_id", required = false) String organizationId,
            @RequestParam(value = "matched_object_uuid", required = false) String matchedObjectUuid) {
        GeoCoordinates coordinates = (latitude != null && longitude != null)
                ? GeoCoordinates.builder().latitude(latitude).longitude(longitude).build()
                : null;
        ReportLostObjectCommand command = ReportLostObjectCommand.builder()
                .image(file)
                .description(description)
                .username(user.getUsername())
                .lostDate(lostDate)
                .geoCoordinates(coordinates)
                .organizationId(organizationId)
                .matchedObjectUuid(matchedObjectUuid)
                .build();
        lostObjectService.reportLostObject(command);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/my")
    @Operation(summary = "Mis búsquedas guardadas",
            description = "Retorna las búsquedas guardadas del usuario autenticado (activas y cerradas).")
    public ResponseEntity<List<LostObjectResponseDto>> getMyLostObjects(
            @AuthenticationPrincipal UserEurekapp user) {
        return ResponseEntity.ok(lostObjectService.getMyLostObjects(user.getUsername()));
    }

    @PostMapping("/{uuid}/close")
    @PreAuthorize("hasAuthority('USER')")
    @Operation(summary = "Cerrar una búsqueda guardada",
            description = "Cierra (lógicamente) una búsqueda guardada del usuario. El cierre es terminal: "
                    + "no se reabre. Registra la respuesta a '¿Recuperaste tu objeto?' como feedback.")
    public ResponseEntity<Void> closeLostObject(
            @AuthenticationPrincipal UserEurekapp user,
            @PathVariable String uuid,
            @Valid @RequestBody CloseLostObjectRequestDto request) {
        lostObjectService.closeLostObject(user.getUsername(), uuid, request.getRecovered());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{uuid}/pending-pickup")
    @PreAuthorize("hasAuthority('USER')")
    @Operation(summary = "Marcar una búsqueda como 'Por retirar'",
            description = "El usuario reconoció un objeto encontrado como suyo y va a ir a retirarlo. "
                    + "La búsqueda pasa a PENDING_PICKUP y guarda cuál es el objeto, para poder "
                    + "mostrarle en qué organización está. No es terminal: si al verlo resulta que no "
                    + "era el suyo, vuelve a ACTIVE. Sigue recibiendo avisos de coincidencia.")
    public ResponseEntity<Void> markPendingPickup(
            @AuthenticationPrincipal UserEurekapp user,
            @PathVariable String uuid,
            @Valid @RequestBody PendingPickupRequestDto request) {
        lostObjectService.markPendingPickup(user.getUsername(), uuid, request.getFoundObjectUuid());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{uuid}/reopen")
    @PreAuthorize("hasAuthority('USER')")
    @Operation(summary = "Volver a 'Buscando' una búsqueda 'Por retirar'",
            description = "El usuario fue a la organización, vio el objeto y no era el suyo. La "
                    + "búsqueda vuelve a ACTIVE y se limpia la referencia al objeto. No se cierra: "
                    + "sigue buscando.")
    public ResponseEntity<Void> reopenLostObject(
            @AuthenticationPrincipal UserEurekapp user,
            @PathVariable String uuid) {
        lostObjectService.reopenLostObject(user.getUsername(), uuid);
        return ResponseEntity.ok().build();
    }
}
