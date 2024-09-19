package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.request.LoginDto;
import com.eurekapp.backend.dto.request.UserDto;
import com.eurekapp.backend.dto.response.JwtTokenDto;
import com.eurekapp.backend.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin("*")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<JwtTokenDto> login(@Valid @RequestBody LoginDto loginDto) {
        JwtTokenDto jwtToken = authService.login(loginDto);
        return ResponseEntity.ok(jwtToken);
    }

    @PostMapping("/signup")
    public ResponseEntity<JwtTokenDto> register(@Valid @RequestBody UserDto userDto) {
        return ResponseEntity.ok(authService.register(userDto));
    }
}
