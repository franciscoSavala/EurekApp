package com.eurekapp.backend.service;

import com.eurekapp.backend.configuration.JwtService;
import com.eurekapp.backend.dto.request.UserDto;
import com.eurekapp.backend.dto.response.JwtTokenDto;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IUserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final IUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    public AuthService(IUserRepository userRepository, JwtService jwtService, AuthenticationManager authenticationManager) {
        this.userRepository = userRepository;
        this.passwordEncoder = new BCryptPasswordEncoder();
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
    }

    public JwtTokenDto login(UserDto user) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        user.getUsername(),
                        user.getPassword()
                )
        );
        UserEurekapp userEurekapp = userRepository.findByUsername(user.getUsername())
                .orElseThrow(
                        () -> new NotFoundException(
                                String.format("No se encontró el usuario con el username %s",
                                        user.getUsername())
                        ));

        String jwt = jwtService.generateToken(userEurekapp);
        return JwtTokenDto.builder().token(jwt).build();
    }

    public JwtTokenDto register(UserDto user){
        UserEurekapp userDetails = UserEurekapp.builder()
                .role(Role.USER)
                .password(passwordEncoder.encode(user.getPassword()))
                .username(user.getUsername())
                .build();

        userRepository.save(userDetails);

        String jwtToken = jwtService.generateToken(userDetails);

        return JwtTokenDto.builder().token(jwtToken).build();
    }
}