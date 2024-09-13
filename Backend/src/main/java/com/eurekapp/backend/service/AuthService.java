package com.eurekapp.backend.service;

import com.eurekapp.backend.configuration.security.JwtService;
import com.eurekapp.backend.dto.OrganizationDto;
import com.eurekapp.backend.dto.request.LoginDto;
import com.eurekapp.backend.dto.request.UserDto;
import com.eurekapp.backend.dto.response.JwtTokenDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.ForbbidenException;
import com.eurekapp.backend.exception.ValidationError;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IUserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
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


    public JwtTokenDto login(LoginDto user) {
        try {
            // Autenticación del usuario
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(user.getEmail(), user.getPassword())
            );

            // Si la autenticación fue exitosa, recuperamos el usuario
            UserEurekapp userEurekapp = (UserEurekapp) authentication.getPrincipal();

            log.info("[action:login] Usuario {} autenticado exitosamente", user.getEmail());

            // Generamos el token JWT
            String jwt = jwtService.generateToken(userEurekapp);

            // Devolver el token y la organización si está presente
            return createJwtTokenResponse(userEurekapp, jwt);

        } catch (AuthenticationException e) {
            log.error("[action:login] Fallo en la autenticación para el usuario {}", user.getEmail());
            // Si la autenticación falla, lanzamos un error de credenciales inválidas
            throw new BadRequestException(ValidationError.INVALID_CREDENTIALS.getCode(), ValidationError.INVALID_CREDENTIALS.getError());
        }
    }

    public JwtTokenDto register(UserDto user) {
        // Verificar si el usuario ya está registrado
        if (userRepository.findByUsername(user.getEmail()).isPresent()) {
            log.warn("[action:register] Usuario con correo {} ya registrado", user.getEmail());
            throw new ForbbidenException(ValidationError.REPEATED_EMAIL.getCode(), ValidationError.REPEATED_EMAIL.getError());
        }

        // Creación del usuario
        UserEurekapp userDetails = UserEurekapp.builder()
                .role(Role.USER)
                .password(passwordEncoder.encode(user.getPassword()))
                .username(user.getEmail())
                .active(true)
                .build();

        // Guardar usuario en el repositorio
        userRepository.save(userDetails);

        log.info("[action:register] Usuario {} registrado exitosamente", user.getEmail());

        // Generar el token JWT para el usuario registrado
        String jwtToken = jwtService.generateToken(userDetails);

        // Devolver el token JWT
        return JwtTokenDto.builder().token(jwtToken).build();
    }

    // Método auxiliar para crear la respuesta del token JWT
    private JwtTokenDto createJwtTokenResponse(UserEurekapp user, String jwt) {
        Organization organization = user.getOrganization();
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
}