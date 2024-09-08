package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.FoundObjectsListDto;
import com.eurekapp.backend.dto.FoundObjectUploadedResponseDto;
import com.eurekapp.backend.dto.ReturnFoundObjectResponseDto;
import com.eurekapp.backend.model.ReturnFoundObjectCommand;
import com.eurekapp.backend.model.SimilarObjectsCommand;
import com.eurekapp.backend.model.UploadFoundObjectCommand;
import com.eurekapp.backend.service.IFoundObjectService;
import com.eurekapp.backend.service.ReturnFoundObjectService;
import org.hibernate.validator.constraints.Length;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/found-objects")
@CrossOrigin("*")
public class FoundObjectController {
    @Autowired
    private IFoundObjectService service;
    @Autowired
    private ReturnFoundObjectService returnFoundObjectService;

    /* Esta clase nuclea a los endpoints correspondientes a los posteos de objetos encontrados. */

    // Endpoint usado para postear un objeto encontrado, con foto y descripción textual.
    @PostMapping(value = "/organizations/{organizationId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<FoundObjectUploadedResponseDto> uploadFoundObject(
            @RequestParam("file") MultipartFile file,
            @RequestParam("description") @Length(max = 150, message = "Max description size is 150") String description,
            @RequestParam(value = "found_date") LocalDateTime foundDate,
            @PathVariable(value = "organizationId", required = false) Long organizationId){
        UploadFoundObjectCommand command = UploadFoundObjectCommand.builder()
                .image(file)
                .description(description)
                .foundDate(foundDate)
                .organizationId(organizationId)
                .build();
        return ResponseEntity.ok(service.uploadFoundObject(command));
    }

    // Endpoint que devuelve los objetos perdidos en una organización en particular que tengan el mayor grado de
    // coincidencia con la descripción textual provista.
    @GetMapping("/organizations/{organizationId}")
    public ResponseEntity<FoundObjectsListDto> getFoundObjectsByTextDescriptionAndOrganization(
            @RequestParam @Length(max = 255, message = "Max length supported is 255") String query,
            @PathVariable(name = "organizationId", required = false) Long organizationId,
            @RequestParam(name = "lost_date", required = false) LocalDateTime lostDate){
        SimilarObjectsCommand command = SimilarObjectsCommand.builder()
                .query(query)
                .organizationId(organizationId)
                .lostDate(lostDate)
                .build();
        return ResponseEntity.ok(service.getFoundObjectByTextDescription(command));
    }

    // Endpoint que devuelve todos los objetos encontrados que una organización tiene en su poder actualmente.
    @GetMapping("/organizations/all/{organizationId}")
    public ResponseEntity<FoundObjectsListDto> getAllUnreturnedFoundObjectsByOrganization(
            @PathVariable(name = "organizationId", required = false) Long organizationId){
        SimilarObjectsCommand command = SimilarObjectsCommand.builder()
                .organizationId(organizationId)
                .build();
        return ResponseEntity.ok(service.getAllUnreturnedFoundObjectsByOrganization(command));
    }

    // Endpoint que devuelve los objetos perdidos en todas las organizaciones que tengan el mayor grado de coincidencia
    // con la descripción textual provista.
    @GetMapping
    public ResponseEntity<FoundObjectsListDto> getFoundObjectsByTextDescription(
            @RequestParam @Length(max = 255, message = "Max length supported is 255") String query){
        SimilarObjectsCommand command = SimilarObjectsCommand.builder()
                .query(query)
                .build();
        return ResponseEntity.ok(service.getFoundObjectByTextDescription(command));
    }

    @PostMapping("/return/{organizationId}")
    public ResponseEntity<ReturnFoundObjectResponseDto> returnLostObject(
            @RequestBody ReturnFoundObjectCommand command,
            @PathVariable(name = "organizationId") Long organizationId) {
        command.setOrganizationId(organizationId);
        return ResponseEntity.ok(returnFoundObjectService.returnFoundObject(command));
    }
}
