package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.request.LoginRequestDto;
import com.eurekapp.backend.dto.request.SocialLoginRequestDto;
import com.eurekapp.backend.dto.request.UserRegistrationRequestDto;
import com.eurekapp.backend.dto.response.LoginResponseDto;
import com.eurekapp.backend.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin("*")
@Tag(name = "Autenticación", description = "Registro e inicio de sesión de usuarios")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    @Operation(summary = "Iniciar sesión", description = "Autentica al usuario y devuelve un token JWT")
    public ResponseEntity<LoginResponseDto> login(@Valid @RequestBody LoginRequestDto loginRequestDto) {
        LoginResponseDto loginResponseDto = authService.login(loginRequestDto);
        return ResponseEntity.ok(loginResponseDto);
    }

    @PostMapping("/signup")
    @Operation(summary = "Registrar usuario", description = "Crea una nueva cuenta de usuario con rol USER")
    public ResponseEntity<LoginResponseDto> register(@Valid @RequestBody UserRegistrationRequestDto userRegistrationRequestDto) {
        return ResponseEntity.ok(authService.register(userRegistrationRequestDto));
    }

    @PostMapping("/auth/social")
    @Operation(summary = "Login social", description = "Autentica o registra un usuario mediante Google o Facebook")
    public ResponseEntity<LoginResponseDto> socialLogin(@Valid @RequestBody SocialLoginRequestDto socialLoginRequestDto) {
        return ResponseEntity.ok(authService.socialLogin(socialLoginRequestDto));
    }
}
