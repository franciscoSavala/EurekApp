package com.eurekapp.backend.controller;

import com.eurekapp.backend.model.Image;
import com.eurekapp.backend.model.WorkItem;
import com.eurekapp.backend.service.PhotoService;
import com.eurekapp.backend.service.RekognitionService;
import lombok.SneakyThrows;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/photo")
public class PhotoController {
    @Autowired
    private PhotoService service;

    @PostMapping
    public ResponseEntity<Image> uploadPhoto(@RequestParam("file") MultipartFile file){
        return ResponseEntity.ok(service.getTagsFromImage(file));
    }

    @SneakyThrows
    @GetMapping(
            produces = MediaType.IMAGE_JPEG_VALUE
    )
    public @ResponseBody byte[] getImageFromTag(@RequestParam("tag") String tag){
        return service.getImageFromTag(tag);
    }
}
