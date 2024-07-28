package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.request.UserDto;
import com.eurekapp.backend.dto.response.JwtTokenDto;
import com.eurekapp.backend.service.AuthService;
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
    public ResponseEntity<JwtTokenDto> login(@RequestBody UserDto userDto) {
        return ResponseEntity.ok(authService.login(userDto));
    }

    @PostMapping("/signup")
    public ResponseEntity<JwtTokenDto> register(@RequestBody UserDto userDto){
        return ResponseEntity.ok(authService.register(userDto));
    }
}
