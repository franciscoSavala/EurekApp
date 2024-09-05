package com.eurekapp.backend.controller;

import com.eurekapp.backend.service.notification.EmailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin("*")
public class TestEndpoint {
    private final EmailService emailService;

    public TestEndpoint(EmailService emailService) {
        this.emailService = emailService;
    }
}
