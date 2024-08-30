package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.TopSimilarFoundObjectsDto;
import com.eurekapp.backend.dto.ImageUploadedResponseDto;
import com.eurekapp.backend.model.SimilarObjectsCommand;
import com.eurekapp.backend.model.UploadFoundObjectCommand;
import com.eurekapp.backend.service.FoundObjectService;
import com.eurekapp.backend.service.IPhotoService;
import org.hibernate.validator.constraints.Length;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/found-objects")
@CrossOrigin("*")
public class FoundObjectController {
    @Autowired
    private IPhotoService service;

    @Autowired
    private FoundObjectService foundObjectService;

    /* Esta clase nuclea a los endpoints correspondientes a los posteos de objetos encontrados. */

    // Endpoint usado para postear un objeto encontrado, con foto y descripción textual.
    @PostMapping("/organizations/{organizationId}")
    public ResponseEntity<ImageUploadedResponseDto> uploadFoundObject(@RequestParam("file") MultipartFile file,
                                                                      @RequestParam("description")
                                                                      @Length(max = 30, message = "Max description size is 30") String description,
                                                                      @RequestParam("found_date") LocalDateTime foundDate,
                                                                      @PathVariable(value = "organizationId", required = false) Long organizationId){
        UploadFoundObjectCommand command = UploadFoundObjectCommand.builder()
                .image(file)
                .description(description)
                .foundDate(foundDate)
                .organizationId(organizationId)
                .build();
        return ResponseEntity.ok(service.uploadFoundObject(command));
    }

    // Endpoint usado para postear un objeto encontrado, con foto y descripción textual, persistiéndolo.
    @PostMapping("/organizations2/{organizationId}")
    public ResponseEntity<ImageUploadedResponseDto> uploadFoundObject2(@RequestParam("file") MultipartFile file,
                                                                      @RequestParam("description")
                                                                      @Length(max = 30, message = "Max description size is 30") String description,
                                                                      @RequestParam("found_date") LocalDateTime foundDate,
                                                                      @PathVariable(value = "organizationId", required = false) Long organizationId){
        UploadFoundObjectCommand command = UploadFoundObjectCommand.builder()
                .image(file)
                .description(description)
                .foundDate(foundDate)
                .organizationId(organizationId)
                .build();
        return ResponseEntity.ok(foundObjectService.uploadFoundObject(command));
    }

    // Endpoint que devuelve los objetos perdidos en una organización en particular que tengan el mayor grado de
    // coincidencia con la descripción textual provista.
    @GetMapping("/organizations/{organizationId}")
    public ResponseEntity<TopSimilarFoundObjectsDto> getFoundObjectsByTextDescriptionAndOrganization(
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

    // Endpoint que devuelve los objetos perdidos en todas las organizaciones que tengan el mayor grado de coincidencia
    // con la descripción textual provista.
    @GetMapping
    public ResponseEntity<TopSimilarFoundObjectsDto> getFoundObjectsByTextDescription(@RequestParam
                                                                                      @Length(max = 255,
                                                                                              message = "Max length supported is 255")
                                                                                      String query){
        SimilarObjectsCommand command = SimilarObjectsCommand.builder()
                .query(query)
                .build();
        return ResponseEntity.ok(service.getFoundObjectByTextDescription(command));
    }
}
