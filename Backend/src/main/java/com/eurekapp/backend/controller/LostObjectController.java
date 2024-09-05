package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.LostObjectResponseDto;
import com.eurekapp.backend.dto.ReportLostObjectCommand;
import com.eurekapp.backend.service.LostObjectService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/lost-object")
@CrossOrigin("*")
public class LostObjectController {

    @Autowired
    private LostObjectService lostObjectService;

    @PostMapping
    public ResponseEntity<LostObjectResponseDto> reportLostObject(@RequestBody ReportLostObjectCommand command) {
        return ResponseEntity.ok(lostObjectService.reportLostObject(command));
    }
}
