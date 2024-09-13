package com.eurekapp.backend.service;

import com.eurekapp.backend.configuration.security.JwtService;
import com.eurekapp.backend.dto.OrganizationDto;
import com.eurekapp.backend.dto.request.UserDto;
import com.eurekapp.backend.dto.response.JwtTokenDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.ForbbidenException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IUserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
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
        // Validación del username
        if (user.getUsername() == null || user.getUsername().trim().isEmpty()) {
            throw new BadRequestException("invalid_username", "El nombre de usuario no puede estar vacío.");
        }

        // Si el username es válido, validamos el password
        if (user.getPassword() == null || user.getPassword().trim().isEmpty()) {
            throw new BadRequestException("invalid_password", "La contraseña no puede estar vacía.");
        }

        // Si ambas validaciones pasan, autenticamos al usuario
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        user.getUsername(),
                        user.getPassword()
                )
        );

        UserEurekapp userEurekapp = userRepository.findByUsername(user.getUsername())
                .orElseThrow(
                        () -> new NotFoundException(
                                "user_not_found",
                                String.format("No se encontró el usuario con el username %s",
                                        user.getUsername())
                        ));
        log.info("[action:login] User {} logged", user.getUsername());
        String jwt = jwtService.generateToken(userEurekapp);
        Organization organization = userEurekapp.getOrganization();
        if (organization != null) {
            OrganizationDto organizationDto = OrganizationDto.builder()
                    .id(organization.getId())
                    .name(organization.getName())
                    .contactData(organization.getContactData())
                    .build();
            return JwtTokenDto.builder().organization(organizationDto).token(jwt).build();
        }
        return JwtTokenDto.builder().token(jwt).build();
    }

    public JwtTokenDto register(UserDto user){
        // Validación del username
        if (user.getUsername() == null || user.getUsername().trim().isEmpty()) {
            throw new BadRequestException("invalid_username", "El nombre de usuario no puede estar vacío.");
        }

        // Si el username es válido, validamos el password
        if (user.getPassword() == null || user.getPassword().trim().isEmpty()) {
            throw new BadRequestException("invalid_password", "La contraseña no puede estar vacía.");
        }


        if(userRepository.findByUsername(user.getUsername())
                .isPresent())
            throw new ForbbidenException("repeated_user","Ya existe un usuario con ese nombre de usuario");

        UserEurekapp userDetails = UserEurekapp.builder()
                .role(Role.USER)
                .password(passwordEncoder.encode(user.getPassword()))
                .username(user.getUsername())
                .active(true)
                .build();

        userRepository.save(userDetails);

        String jwtToken = jwtService.generateToken(userDetails);

        return JwtTokenDto.builder().token(jwtToken).build();
    }
}
