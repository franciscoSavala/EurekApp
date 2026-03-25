package com.eurekapp.backend.service;

import com.eurekapp.backend.configuration.security.JwtService;
import com.eurekapp.backend.dto.OrganizationDto;
import com.eurekapp.backend.dto.UserDto;
import com.eurekapp.backend.dto.request.LoginRequestDto;
import com.eurekapp.backend.dto.request.SocialLoginRequestDto;
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
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {
    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final IUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final RestTemplate restTemplate;

    public AuthService(IUserRepository userRepository, JwtService jwtService, AuthenticationManager authenticationManager) {
        this.userRepository = userRepository;
        this.passwordEncoder = new BCryptPasswordEncoder();
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
        this.restTemplate = new RestTemplate();
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
        UserEurekapp newUser = UserEurekapp.builder()
                .role(Role.USER)
                .password(passwordEncoder.encode(user.getPassword()))
                .username(user.getUsername())
                .firstName(user.getFirstname())
                .lastName(user.getLastname())
                .active(true)
                .XP(0L)
                .returnedObjects(0L)
                .build();

        // Guardar usuario en el repositorio
        userRepository.save(newUser);

        log.info("[action:register] Usuario {} registrado exitosamente", user.getUsername());

        // Generar el token JWT para el usuario registrado
        String jwtToken = jwtService.generateToken(newUser);

        return createLoginResponse(newUser, jwtToken);
    }

    public LoginResponseDto socialLogin(SocialLoginRequestDto request) {
        String provider = request.getProvider().toUpperCase();
        String email, firstName, lastName, providerId;

        if ("GOOGLE".equals(provider)) {
            Map<String, Object> data = validateGoogleToken(request.getIdToken());
            email      = (String) data.get("email");
            firstName  = (String) data.getOrDefault("given_name", "");
            lastName   = (String) data.getOrDefault("family_name", "");
            providerId = (String) data.get("sub");
        } else if ("FACEBOOK".equals(provider)) {
            Map<String, Object> data = validateFacebookToken(request.getIdToken());
            email      = (String) data.get("email");
            firstName  = (String) data.getOrDefault("first_name", "");
            lastName   = (String) data.getOrDefault("last_name", "");
            providerId = (String) data.get("id");
        } else {
            throw new BadRequestException(ValidationError.INVALID_SOCIAL_TOKEN);
        }

        if (email == null || email.isBlank()) {
            throw new BadRequestException(ValidationError.MISSING_SOCIAL_EMAIL);
        }

        Optional<UserEurekapp> existingUser = userRepository.findByUsername(email);
        UserEurekapp user;
        if (existingUser.isPresent()) {
            user = existingUser.get();
            if (user.getProviderId() == null) {
                user.setProviderType(provider);
                user.setProviderId(providerId);
                userRepository.save(user);
            }
        } else {
            String dummyPassword = passwordEncoder.encode(UUID.randomUUID().toString());
            user = UserEurekapp.builder()
                    .username(email)
                    .firstName(firstName.isBlank() ? email.split("@")[0] : firstName)
                    .lastName(lastName.isBlank() ? "-" : lastName)
                    .password(dummyPassword)
                    .role(Role.USER)
                    .XP(0L)
                    .returnedObjects(0L)
                    .active(true)
                    .providerType(provider)
                    .providerId(providerId)
                    .build();
            userRepository.save(user);
        }

        log.info("[action:socialLogin] Usuario {} autenticado via {}", email, provider);
        String token = jwtService.generateToken(user);
        return createLoginResponse(user, token);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> validateGoogleToken(String idToken) {
        String url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken;
        try {
            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new BadRequestException(ValidationError.INVALID_SOCIAL_TOKEN);
            }
            return response.getBody();
        } catch (RestClientException e) {
            throw new BadRequestException(ValidationError.INVALID_SOCIAL_TOKEN);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> validateFacebookToken(String accessToken) {
        String url = "https://graph.facebook.com/me?fields=id,first_name,last_name,email&access_token=" + accessToken;
        try {
            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new BadRequestException(ValidationError.INVALID_SOCIAL_TOKEN);
            }
            return response.getBody();
        } catch (RestClientException e) {
            throw new BadRequestException(ValidationError.INVALID_SOCIAL_TOKEN);
        }
    }

    // Metodo auxiliar para crear la respuesta del token JWT
    private LoginResponseDto createLoginResponse(UserEurekapp user, String jwt) {
        UserDto userDto = UserDto.builder()
                .username(user.getUsername())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .role(user.getRole().toString())
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