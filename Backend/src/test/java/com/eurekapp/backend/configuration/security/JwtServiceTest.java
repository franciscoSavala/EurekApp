package com.eurekapp.backend.configuration.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JwtServiceTest {

    // Clave BASE64 de prueba (no se usa en ningún entorno real).
    private static final String TEST_KEY = "ZXVyZWthcHAtdGVzdC1zaWduaW5nLWtleS0wMTIzNDU2Nzg5LWFiY2RlZg==";

    private JwtService jwtService;
    private UserDetails user;

    @BeforeEach
    void setUp() {
        // access 60 min, refresh 30 días (los defaults de producción).
        jwtService = new JwtService(TEST_KEY, 60, 43200);
        user = new User("usuario@eurekapp.com", "irrelevant",
                List.of(new SimpleGrantedAuthority("USER")));
    }

    @Test
    void accessTokenIsValidAndCarriesUsername() {
        String accessToken = jwtService.generateToken(user);

        assertEquals("usuario@eurekapp.com", jwtService.getUsername(accessToken));
        assertTrue(jwtService.isTokenValid(accessToken, user));
    }

    @Test
    void accessTokenIsNotRecognizedAsRefreshToken() {
        String accessToken = jwtService.generateToken(user);

        // Un access token no debe poder usarse en el endpoint de refresh.
        assertFalse(jwtService.isRefreshToken(accessToken));
    }

    @Test
    void refreshTokenIsRecognizedAsRefreshAndCarriesUsername() {
        String refreshToken = jwtService.generateRefreshToken(user);

        assertTrue(jwtService.isRefreshToken(refreshToken));
        assertEquals("usuario@eurekapp.com", jwtService.getUsername(refreshToken));
    }
}
