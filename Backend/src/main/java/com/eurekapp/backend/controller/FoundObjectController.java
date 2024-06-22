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
@Validated
public class FoundObjectController {
    @Autowired
    private PhotoService service;

    @PostMapping
    public ResponseEntity<ImageUploadedResponseDto> uploadFoundObject(@RequestParam("file") MultipartFile file,
                                                                      @RequestParam("description") @Size(max = 100) String description){
        return ResponseEntity.ok(service.uploadFoundObject(file, description));
    }

    @GetMapping("/organizations/{organizationId}")
    public ResponseEntity<TopSimilarFoundObjectsDto> getFoundObjectsByTextDescriptionAndOrganization(@RequestParam
                                                                                          @Length(max = 255,
                                                                                                  message = "Max length supported is 256")
                                                                                          String query,
                                                                                      @PathVariable(name = "organizationId",
                                                                                              required = false) Long organizationId){
        return ResponseEntity.ok(service.getFoundObjectByTextDescription(query, organizationId));
    }
    @GetMapping
    public ResponseEntity<TopSimilarFoundObjectsDto> getFoundObjectsByTextDescription(@RequestParam
                                                                                      @Length(max = 255,
                                                                                              message = "Max length supported is 256")
                                                                                      String query){
        return ResponseEntity.ok(service.getFoundObjectByTextDescription(query, null));
    }
}
