package com.eurekapp.backend.controller;

import com.eurekapp.backend.service.notification.EmailService;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin("*")
public class TestEndpoint {
    private final EmailService emailService;

    public TestEndpoint(EmailService emailService) {
        this.emailService = emailService;
    }
}
