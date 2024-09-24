package com.eurekapp.backend.service;

import com.eurekapp.backend.configuration.security.JwtService;
import com.eurekapp.backend.dto.OrganizationDto;
import com.eurekapp.backend.dto.UserDto;
import com.eurekapp.backend.dto.request.LoginRequestDto;
import com.eurekapp.backend.dto.request.UserRegistrationRequestDto;
import com.eurekapp.backend.dto.response.LoginResponseDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.ForbbidenException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.exception.ValidationError;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IUserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
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


    public LoginResponseDto login(LoginRequestDto user) {
        try {
            // Autenticación del usuario
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(user.getUsername(), user.getPassword())
            );

            // Si la autenticación fue exitosa, recuperamos el usuario
            UserEurekapp userEurekapp = userRepository.findByUsername(user.getUsername())
                    .orElseThrow(
                            () -> new NotFoundException(
                                    "user_not_found",
                                    String.format("No se encontró el usuario con el username %s", user.getUsername())
                            ));

            log.info("[action:login] Usuario {} autenticado exitosamente", user.getUsername());

            // Generamos el token JWT
            String jwt = jwtService.generateToken(userEurekapp);

            // Devolver el token, datos del usuario, y la organización si está presente.
            return createLoginResponse(userEurekapp, jwt);

        } catch (AuthenticationException e) {
            log.error("[action:login] Fallo en la autenticación para el usuario {}", user.getUsername());
            // Si la autenticación falla, lanzamos un error de credenciales inválidas
            throw new BadRequestException(ValidationError.INVALID_CREDENTIALS);
        }
    }

    public LoginResponseDto register(UserRegistrationRequestDto user) {
        // Verificar si el usuario ya está registrado
        if (userRepository.findByUsername(user.getUsername()).isPresent()) {
            log.warn("[action:register] Usuario con correo {} ya registrado", user.getUsername());
            throw new ForbbidenException(ValidationError.REPEATED_EMAIL.getCode(), ValidationError.REPEATED_EMAIL.getError());
        }

        // Creación del usuario
        UserEurekapp userDetails = UserEurekapp.builder()
                .role(Role.USER)
                .password(passwordEncoder.encode(user.getPassword()))
                .username(user.getUsername())
                .firstName(user.getNombre())
                .lastName(user.getApellido())
                .active(true)
                .build();

        // Guardar usuario en el repositorio
        userRepository.save(userDetails);

        log.info("[action:register] Usuario {} registrado exitosamente", user.getUsername());

        // Generar el token JWT para el usuario registrado
        String jwtToken = jwtService.generateToken(userDetails);

        // Devolver el token JWT
        return LoginResponseDto.builder().token(jwtToken).build();
    }

    // Metodo auxiliar para crear la respuesta del token JWT
    private LoginResponseDto createLoginResponse(UserEurekapp user, String jwt) {
        UserDto userDto = UserDto.builder()
                .username(user.getUsername())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .build();

        Organization organization = user.getOrganization();
        if (organization != null) {
            OrganizationDto organizationDto = OrganizationDto.builder()
                    .id(organization.getId())
                    .name(organization.getName())
                    .contactData(organization.getContactData())
                    .build();
            return LoginResponseDto.builder().organization(organizationDto).user(userDto).token(jwt).build();
        }

        return LoginResponseDto.builder().user(userDto).token(jwt).build();
    }
}