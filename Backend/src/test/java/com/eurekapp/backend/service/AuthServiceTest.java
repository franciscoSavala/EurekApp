package com.eurekapp.backend.service;

import com.eurekapp.backend.configuration.security.JwtService;
import com.eurekapp.backend.dto.request.LoginRequestDto;
import com.eurekapp.backend.dto.request.UserRegistrationRequestDto;
import com.eurekapp.backend.dto.response.LoginResponseDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.ForbbidenException;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IUserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock IUserRepository userRepository;
    @Mock JwtService jwtService;
    @Mock AuthenticationManager authenticationManager;

    @InjectMocks AuthService authService;

    private UserEurekapp buildUser(String username) {
        return UserEurekapp.builder()
                .id(1L)
                .username(username)
                .password("encoded_password")
                .firstName("Test")
                .lastName("User")
                .role(Role.USER)
                .active(true)
                .XP(0L)
                .returnedObjects(0L)
                .build();
    }

    // --- login ---

    @Test
    void login_validCredentials_returnsTokenAndUserInfo() {
        UserEurekapp user = buildUser("testuser@mail.com");
        when(authenticationManager.authenticate(any())).thenReturn(null);
        when(userRepository.findByUsername("testuser@mail.com")).thenReturn(Optional.of(user));
        when(jwtService.generateToken(user)).thenReturn("jwt-token-123");

        LoginResponseDto response = authService.login(
                LoginRequestDto.builder().username("testuser@mail.com").password("password").build());

        assertThat(response.getToken()).isEqualTo("jwt-token-123");
        assertThat(response.getUser().getUsername()).isEqualTo("testuser@mail.com");
    }

    @Test
    void login_invalidCredentials_throwsBadRequestException() {
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenThrow(new BadCredentialsException("bad credentials"));

        assertThatThrownBy(() -> authService.login(
                LoginRequestDto.builder().username("user@mail.com").password("wrongpass").build()))
                .isInstanceOf(BadRequestException.class);
    }

    // --- register ---

    @Test
    void register_newUser_savesWithZeroXPAndZeroReturnedObjects() {
        when(userRepository.findByUsername("new@mail.com")).thenReturn(Optional.empty());
        when(userRepository.save(any(UserEurekapp.class))).thenAnswer(inv -> inv.getArgument(0));
        when(jwtService.generateToken(any(UserEurekapp.class))).thenReturn("new-jwt");

        authService.register(UserRegistrationRequestDto.builder()
                .username("new@mail.com")
                .password("password123")
                .firstname("Ana")
                .lastname("García")
                .build());

        ArgumentCaptor<UserEurekapp> captor = ArgumentCaptor.forClass(UserEurekapp.class);
        verify(userRepository).save(captor.capture());

        UserEurekapp saved = captor.getValue();
        assertThat(saved.getXP()).isEqualTo(0L);
        assertThat(saved.getReturnedObjects()).isEqualTo(0L);
        assertThat(saved.getRole()).isEqualTo(Role.USER);
        assertThat(saved.isActive()).isTrue();
    }

    @Test
    void register_newUser_returnsTokenAndUserInfo() {
        UserEurekapp savedUser = buildUser("new@mail.com");
        when(userRepository.findByUsername("new@mail.com")).thenReturn(Optional.empty());
        when(userRepository.save(any(UserEurekapp.class))).thenReturn(savedUser);
        when(jwtService.generateToken(any(UserEurekapp.class))).thenReturn("new-jwt");

        LoginResponseDto response = authService.register(UserRegistrationRequestDto.builder()
                .username("new@mail.com")
                .password("password123")
                .firstname("Ana")
                .lastname("García")
                .build());

        assertThat(response.getToken()).isEqualTo("new-jwt");
        assertThat(response.getUser().getUsername()).isEqualTo("new@mail.com");
    }

    @Test
    void register_duplicateUsername_throwsForbbidenException() {
        when(userRepository.findByUsername("existing@mail.com"))
                .thenReturn(Optional.of(buildUser("existing@mail.com")));

        assertThatThrownBy(() -> authService.register(UserRegistrationRequestDto.builder()
                .username("existing@mail.com")
                .password("password123")
                .firstname("Ana")
                .lastname("García")
                .build()))
                .isInstanceOf(ForbbidenException.class);
    }

    @Test
    void register_newUser_passwordIsEncoded() {
        when(userRepository.findByUsername(any())).thenReturn(Optional.empty());
        when(userRepository.save(any(UserEurekapp.class))).thenAnswer(inv -> inv.getArgument(0));
        when(jwtService.generateToken(any())).thenReturn("token");

        authService.register(UserRegistrationRequestDto.builder()
                .username("user@mail.com")
                .password("plaintext")
                .firstname("Test")
                .lastname("User")
                .build());

        ArgumentCaptor<UserEurekapp> captor = ArgumentCaptor.forClass(UserEurekapp.class);
        verify(userRepository).save(captor.capture());

        // Password should NOT be stored in plaintext
        assertThat(captor.getValue().getPassword()).isNotEqualTo("plaintext");
        assertThat(captor.getValue().getPassword()).isNotBlank();
    }
}
