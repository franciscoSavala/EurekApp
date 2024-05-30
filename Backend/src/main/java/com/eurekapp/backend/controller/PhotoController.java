package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.TopSimilarImagesDto;
import com.eurekapp.backend.dto.ImageUploadedResponseDto;
import com.eurekapp.backend.service.PhotoService;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/photos")
@CrossOrigin("*")
@Validated
public class PhotoController {
    @Autowired
    private PhotoService service;

    @PostMapping
    public ResponseEntity<ImageUploadedResponseDto> uploadPhoto(@RequestParam("file") MultipartFile file,
                                                                @RequestParam("description") @Size(max = 100) String description){
        return ResponseEntity.ok(service.uploadPhoto(file, description));
    }

    @GetMapping
    public ResponseEntity<TopSimilarImagesDto> getImagesByTextDescription(@RequestParam String query){
        return ResponseEntity.ok(service.getImageByTextDescription(query));
    }
}
