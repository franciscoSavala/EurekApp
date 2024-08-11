package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.TopSimilarFoundObjectsDto;
import com.eurekapp.backend.dto.ImageUploadedResponseDto;
import com.eurekapp.backend.service.PhotoService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Size;
import org.hibernate.validator.constraints.Length;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/found-objects")
@CrossOrigin("*")
public class FoundObjectController {
    @Autowired
    private PhotoService service;

    /* Esta clase nuclea a los endpoints correspondientes a los posteos de objetos encontrados. */

    // Endpoint usado para postear un objeto encontrado, con foto y descripción textual.
    @PostMapping("/organizations/{organizationId}")
    public ResponseEntity<ImageUploadedResponseDto> uploadFoundObject(@RequestParam("file") MultipartFile file,
                                                                      @RequestParam("description") @Length(max = 30, message = "Max description size is 30") String description,
                                                                      @PathVariable(value = "organizationId", required = false) Long organizationId){
        return ResponseEntity.ok(service.uploadFoundObject(file, description, organizationId));
    }

    // Endpoint que devuelve los objetos perdidos en una organización en particular que tengan el mayor grado de
    // coincidencia con la descripción textual provista.
    @GetMapping("/organizations/{organizationId}")
    public ResponseEntity<TopSimilarFoundObjectsDto> getFoundObjectsByTextDescriptionAndOrganization(@RequestParam
                                                                                          @Length(max = 255,
                                                                                                  message = "Max length supported is 255")
                                                                                          String query,
                                                                                      @PathVariable(name = "organizationId",
                                                                                              required = false) Long organizationId){
        return ResponseEntity.ok(service.getFoundObjectByTextDescription(query, organizationId));
    }

    // Endpoint que devuelve los objetos perdidos en todas las organizaciones que tengan el mayor grado de coincidencia
    // con la descripción textual provista.
    @GetMapping
    public ResponseEntity<TopSimilarFoundObjectsDto> getFoundObjectsByTextDescription(@RequestParam
                                                                                      @Length(max = 255,
                                                                                              message = "Max length supported is 255")
                                                                                      String query){
        return ResponseEntity.ok(service.getFoundObjectByTextDescription(query, null));
    }
}
