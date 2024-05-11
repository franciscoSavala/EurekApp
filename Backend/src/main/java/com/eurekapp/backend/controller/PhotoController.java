package com.eurekapp.backend.controller;

import com.eurekapp.backend.model.WorkItem;
import com.eurekapp.backend.service.PhotoService;
import com.eurekapp.backend.service.RekognitionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
public class PhotoController {
    @Autowired
    private PhotoService service;

    @PostMapping("/photo")
    public ResponseEntity<List<WorkItem>> getTagsFromPhoto(@RequestParam("file") MultipartFile file){
        return ResponseEntity.ok(service.getTagsFromImage(file));
    }
}
