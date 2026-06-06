package com.eurekapp.backend.service;

import com.eurekapp.backend.configuration.security.JwtService;
import com.eurekapp.backend.dto.response.LoginResponseDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IUserRepository;
import com.eurekapp.backend.service.notification.NotificationService;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AuthenticationManager;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceRefreshTest {

    private IUserRepository userRepository;
    private JwtService jwtService;
    private AuthService authService;

    private UserEurekapp user;

    @BeforeEach
    void setUp() {
        userRepository = mock(IUserRepository.class);
        jwtService = mock(JwtService.class);
        AuthenticationManager authenticationManager = mock(AuthenticationManager.class);
        NotificationService notificationService = mock(NotificationService.class);
        EmailTemplateService emailTemplateService = mock(EmailTemplateService.class);

        authService = new AuthService(userRepository, jwtService, authenticationManager, notificationService, emailTemplateService);

        user = UserEurekapp.builder()
                .username("usuario@eurekapp.com")
                .password("hashed")
                .firstName("Juan")
                .lastName("Perez")
                .role(Role.USER)
                .active(true)
                .build();
    }

    @Test
    void refreshToken_validToken_returnsNewAccessAndRefresh() {
        String validRefresh = "valid-refresh-token";
        when(jwtService.isRefreshToken(validRefresh)).thenReturn(true);
        when(jwtService.getUsername(validRefresh)).thenReturn("usuario@eurekapp.com");
        when(userRepository.findByUsername("usuario@eurekapp.com")).thenReturn(Optional.of(user));
        when(jwtService.generateToken(user)).thenReturn("new-access-token");
        when(jwtService.generateRefreshToken(user)).thenReturn("new-refresh-token");

        LoginResponseDto response = authService.refreshToken(validRefresh);

        assertEquals("new-access-token", response.getToken());
        assertEquals("new-refresh-token", response.getRefreshToken());
        assertEquals("usuario@eurekapp.com", response.getUser().getUsername());
    }

    @Test
    void refreshToken_accessTokenUsedInsteadOfRefresh_throwsBadRequest() {
        // Un access token (type != refresh) no debe permitir renovar.
        String accessToken = "an-access-token";
        when(jwtService.isRefreshToken(accessToken)).thenReturn(false);

        assertThrows(BadRequestException.class, () -> authService.refreshToken(accessToken));
        verify(userRepository, never()).findByUsername(any());
    }

    @Test
    void refreshToken_malformedOrExpiredToken_throwsBadRequest() {
        String badToken = "expired-or-tampered";
        when(jwtService.isRefreshToken(badToken)).thenThrow(new JwtException("expired"));

        assertThrows(BadRequestException.class, () -> authService.refreshToken(badToken));
        verify(userRepository, never()).findByUsername(any());
    }
}
