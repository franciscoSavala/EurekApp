package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.ImageScoreDto;
import com.eurekapp.backend.dto.TextRequestDto;
import com.eurekapp.backend.dto.TopSimilarImagesDto;
import com.eurekapp.backend.model.ImageDto;
import com.eurekapp.backend.service.PhotoService;
import lombok.SneakyThrows;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/photos")
@CrossOrigin("*")
public class PhotoController {
    @Autowired
    private PhotoService service;

    @PostMapping
    public ResponseEntity<ImageDto> uploadPhoto(@RequestParam("file") MultipartFile file){
        return ResponseEntity.ok(service.uploadPhoto(file));
    }

    @GetMapping
    public ResponseEntity<TopSimilarImagesDto> getImagesByTextDescription(@RequestParam String query){
        return ResponseEntity.ok(service.getImageByTextDescription(query));
    }
}
