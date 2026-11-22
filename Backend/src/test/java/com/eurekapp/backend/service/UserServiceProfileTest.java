package com.eurekapp.backend.service;

import com.eurekapp.backend.configuration.security.JwtService;
import com.eurekapp.backend.dto.response.LoginResponseDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IAddEmployeeRequestRepository;
import com.eurekapp.backend.repository.IUserRepository;
import com.eurekapp.backend.service.notification.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class UserServiceProfileTest {

    private IUserRepository userRepository;
    private UserService userService;
    private UserEurekapp user;

    @BeforeEach
    void setUp() {
        userRepository = mock(IUserRepository.class);
        userService = new UserService(userRepository, mock(IAddEmployeeRequestRepository.class),
                mock(NotificationService.class), mock(InAppNotificationService.class),
                mock(EmailTemplateService.class), mock(JwtService.class));
        user = UserEurekapp.builder().username("u@eurekapp.com").firstName("Ana").lastName("Gomez")
                .role(Role.USER).build();
    }

    @Test
    void guardaNombreYApellidoNuevosSinTocarElEmail() {
        LoginResponseDto r = userService.updateProfile(user, "  Laura ", "Perez");
        assertEquals("Laura", r.getUser().getFirstName());
        assertEquals("Perez", r.getUser().getLastName());
        assertEquals("u@eurekapp.com", r.getUser().getUsername());
        verify(userRepository).saveAndFlush(user);
    }

    @Test
    void rechazaNombreVacio() {
        assertThrows(BadRequestException.class, () -> userService.updateProfile(user, "   ", "Perez"));
        assertEquals("Ana", user.getFirstName());
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    void rechazaApellidoVacio() {
        assertThrows(BadRequestException.class, () -> userService.updateProfile(user, "Laura", null));
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    void rechazaNombreOApellidoDeMasDe50Caracteres() {
        String largo = "a".repeat(51);
        assertThrows(BadRequestException.class, () -> userService.updateProfile(user, largo, "Perez"));
        assertThrows(BadRequestException.class, () -> userService.updateProfile(user, "Laura", largo));
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    void aceptaExactamente50Caracteres() {
        LoginResponseDto r = userService.updateProfile(user, "a".repeat(50), "b".repeat(50));
        assertEquals(50, r.getUser().getFirstName().length());
    }
}
