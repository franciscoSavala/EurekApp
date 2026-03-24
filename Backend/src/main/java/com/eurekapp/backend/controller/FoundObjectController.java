package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.FoundObjectDto;
import com.eurekapp.backend.dto.command.FoundObjectDetailCommand;
import com.eurekapp.backend.dto.response.FoundObjectUploadedResponseDto;
import com.eurekapp.backend.dto.FoundObjectsListDto;
import com.eurekapp.backend.dto.ReturnFoundObjectDto;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.service.IFoundObjectService;
import com.eurekapp.backend.service.ReturnFoundObjectService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Past;
import org.hibernate.validator.constraints.Length;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/found-objects")
@CrossOrigin("*")
@Tag(name = "Objetos Encontrados", description = "Carga, búsqueda y devolución de objetos encontrados")
@SecurityRequirement(name = "bearerAuth")
public class FoundObjectController {

    @Autowired
    private IFoundObjectService foundObjectService;
    @Autowired
    private ReturnFoundObjectService returnFoundObjectService;

    @PostMapping(value = "/organizations/{organizationId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Cargar objeto encontrado",
            description = "Registra un objeto encontrado en el inventario de una organización. La imagen es analizada por IA para generar una descripción automática.")
    public ResponseEntity<FoundObjectUploadedResponseDto> uploadFoundObject(
            @RequestParam("title") @Length(max = 30, message = "Max description size is 30") String title,
            @RequestParam("object_finder_username") String objectFinderUsername,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "detailed_description", required = false) String detailedDescription,
            @RequestParam(value = "found_date") LocalDateTime foundDate,
            @RequestParam(value = "latitude", required = false) Double latitude,
            @RequestParam(value = "longitude", required = false) Double longitude,
            @PathVariable(value = "organizationId", required = false) Long organizationId) {
        UploadFoundObjectCommand command = UploadFoundObjectCommand.builder()
                .title(title)
                .objectFinderUsername(objectFinderUsername)
                .image(file)
                .foundDate(foundDate)
                .organizationId(organizationId)
                .latitude(latitude)
                .longitude(longitude)
                .detailedDescription(detailedDescription != null ? detailedDescription : "")
                .build();
        return ResponseEntity.ok(foundObjectService.uploadFoundObject(command));
    }

    @GetMapping("/organizations/{organizationId}")
    @Operation(summary = "Buscar objetos por organización",
            description = "Búsqueda semántica de objetos encontrados en una organización específica, a partir de una descripción textual y fecha aproximada de pérdida.")
    public ResponseEntity<FoundObjectsListDto> searchFoundObjectsByOrganization(
            @RequestParam @Length(max = 255, message = "Max length supported is 255") String query,
            @PathVariable(name = "organizationId", required = false) Long organizationId,
            @RequestParam(name = "lost_date", required = false) LocalDateTime lostDate) {
        SimilarObjectsCommand command = SimilarObjectsCommand.builder()
                .query(query)
                .organizationId(organizationId)
                .lostDate(lostDate)
                .build();
        return ResponseEntity.ok(foundObjectService.getFoundObjectByTextDescription(command));
    }

    @GetMapping
    @Operation(summary = "Buscar objetos por coordenadas",
            description = "Búsqueda semántica de objetos encontrados cercanos a unas coordenadas geográficas, a partir de una descripción y fecha aproximada.")
    public ResponseEntity<FoundObjectsListDto> searchFoundObjectsByCoordinates(
            @RequestParam @Length(max = 255, message = "Max length supported is 255") String query,
            @RequestParam(name = "lost_date", required = false) @Past LocalDateTime lostDate,
            @RequestParam(name = "latitude") Double latitude,
            @RequestParam(name = "longitude") Double longitude) {
        SimilarObjectsCommand command = SimilarObjectsCommand.builder()
                .query(query)
                .lostDate(lostDate)
                .latitude(latitude)
                .longitude(longitude)
                .build();
        return ResponseEntity.ok(foundObjectService.getFoundObjectByTextDescription(command));
    }

    @GetMapping("/organizations/all/{organizationId}")
    @Operation(summary = "Listar inventario de la organización",
            description = "Devuelve todos los objetos encontrados que la organización tiene actualmente en su poder (no devueltos aún).")
    public ResponseEntity<FoundObjectsListDto> getAllUnreturnedFoundObjectsByOrganization(
            @PathVariable(name = "organizationId", required = false) Long organizationId) {
        SimilarObjectsCommand command = SimilarObjectsCommand.builder()
                .organizationId(organizationId)
                .build();
        return ResponseEntity.ok(foundObjectService.getAllUnreturnedFoundObjectsByOrganization(command));
    }

    @PostMapping(value = "/return/{organizationId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Registrar devolución de objeto",
            description = "Asienta la devolución de un objeto encontrado a su dueño, registrando DNI, teléfono y foto de la persona que lo retira.")
    public ResponseEntity<ReturnFoundObjectDto> returnLostObject(
            @RequestParam(value = "username", required = false) String eurekappUser,
            @RequestParam(value = "dni") String dni,
            @RequestParam(value = "phoneNumber") String phoneNumber,
            @RequestParam(value = "found_object_uuid") String uuid,
            @RequestParam(value = "file") MultipartFile file,
            @PathVariable(name = "organizationId") Long organizationId) {
        ReturnFoundObjectCommand command = ReturnFoundObjectCommand.builder()
                .organizationId(organizationId)
                .foundObjectUUID(uuid)
                .DNI(dni)
                .phoneNumber(phoneNumber)
                .username(eurekappUser)
                .image(file)
                .build();
        return ResponseEntity.ok(returnFoundObjectService.returnFoundObject(command));
    }

    @PostMapping("/getDetail")
    @Operation(summary = "Obtener detalle de un objeto encontrado",
            description = "Devuelve todos los datos de un objeto encontrado (imagen incluida en base64), haya sido devuelto o no.")
    public ResponseEntity<FoundObjectDto> getFoundObjectDetail(@RequestBody FoundObjectDetailCommand command) {
        return ResponseEntity.ok(foundObjectService.getFoundObjectDetail(command));
    }

    @GetMapping("/getReturnedObjects")
    @Operation(summary = "Listar objetos ya devueltos",
            description = "Devuelve todos los objetos que la organización del usuario autenticado ya devolvió a sus dueños.")
    public ResponseEntity<FoundObjectsListDto> getReturnedObjects(@AuthenticationPrincipal UserEurekapp user) {
        return ResponseEntity.ok(foundObjectService.getAllReturnedFoundObjectsByOrganization(user));
    }

    @PostMapping("/getReturnedObject")
    @Operation(summary = "Detalle de una devolución",
            description = "Devuelve los datos completos del registro de devolución de un objeto encontrado específico.")
    public ResponseEntity<ReturnFoundObjectDto> getReturnFoundObjectByFoundObjectId(
            @AuthenticationPrincipal UserEurekapp user,
            @RequestBody GetReturnFoundObjectCommand command) {
        return ResponseEntity.ok(returnFoundObjectService.getReturnFoundObject(user, command.getFoundObjectUUID()));
    }
}
