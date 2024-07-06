package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.OrganizationListResponseDto;
import com.eurekapp.backend.service.OrganizationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/organizations")
@CrossOrigin("*")
public class OrganizationController {
    @Autowired
    private OrganizationService organizationService;

    @GetMapping
    public ResponseEntity<OrganizationListResponseDto> findAllOrganizations() {
        return ResponseEntity.ok(organizationService.getAllOrganizations());
    }
}
