package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.TextRequestDto;
import com.eurekapp.backend.dto.TopEqualTextDto;
import com.eurekapp.backend.model.TextPostedResponseDto;
import com.eurekapp.backend.service.TextService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/text")
public class TextController {
    private final TextService textService;

    public TextController(TextService textService) {
        this.textService = textService;
    }

    @PostMapping
    public ResponseEntity<TextPostedResponseDto> postText(@RequestBody TextRequestDto textRequestDto){
        return ResponseEntity.ok(textService.postText(textRequestDto));
    }

    @GetMapping
    public ResponseEntity<TopEqualTextDto> getSimilarText(@RequestBody TextRequestDto textRequestDto) {
        return ResponseEntity.ok(textService.getSimilarTextFrom(textRequestDto));
    }
}
