package com.eurekapp.backend.service;

import com.eurekapp.backend.configuration.security.JwtService;
import com.eurekapp.backend.dto.OrganizationDto;
import com.eurekapp.backend.dto.UserDto;
import com.eurekapp.backend.dto.request.LoginRequestDto;
import com.eurekapp.backend.dto.request.SocialLoginRequestDto;
import com.eurekapp.backend.dto.request.UserRegistrationRequestDto;
import com.eurekapp.backend.dto.response.LoginResponseDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.ForbiddenException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.exception.ValidationError;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IUserRepository;
import com.eurekapp.backend.service.notification.NotificationService;
import io.jsonwebtoken.JwtException;
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

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.UUID;

@Service
public class AuthService {
    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final IUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final RestTemplate restTemplate;
    private final NotificationService notificationService;

    public AuthService(IUserRepository userRepository, JwtService jwtService, AuthenticationManager authenticationManager, NotificationService notificationService) {
        this.userRepository = userRepository;
        this.passwordEncoder = new BCryptPasswordEncoder();
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
        this.restTemplate = new RestTemplate();
        this.notificationService = notificationService;
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
            throw new ForbiddenException(ValidationError.REPEATED_EMAIL.getCode(), ValidationError.REPEATED_EMAIL.getError());
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

        // Enviar email de bienvenida
        try {
            String subject = "¡Bienvenido/a a EurekApp!";
            String content = "<div style='font-family:sans-serif;max-width:600px;margin:auto;padding:24px'>"
                    + "<h2 style='color:#017575'>¡Hola, " + newUser.getFirstName() + "!</h2>"
                    + "<p>Tu cuenta en <strong>EurekApp</strong> fue creada exitosamente.</p>"
                    + "<p>Ya podés buscar objetos perdidos, reportar objetos encontrados y mucho más.</p>"
                    + "<p style='margin-top:32px;color:#638888;font-size:13px'>Si no creaste esta cuenta, ignorá este mensaje.</p>"
                    + "</div>";
            notificationService.sendNotification(newUser.getUsername(), subject, content);
        } catch (Exception e) {
            log.warn("[action:register] No se pudo enviar el email de bienvenida a {}: {}", newUser.getUsername(), e.getMessage());
        }

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

    public void forgotPassword(String email) {
        UserEurekapp user = userRepository.findByUsername(email)
                .orElseThrow(() -> new NotFoundException(
                        ValidationError.USER_NOT_FOUND.getCode(),
                        String.format(ValidationError.USER_NOT_FOUND.getError(), email)));

        String code = String.format("%06d", new Random().nextInt(999999));
        user.setPasswordResetToken(code);
        user.setPasswordResetTokenExpiry(LocalDateTime.now().plusMinutes(30));
        userRepository.save(user);

        String subject = "Recuperación de contraseña — EurekApp";
        String content = "<div style='font-family:sans-serif;max-width:600px;margin:auto;padding:24px'>"
                + "<h2 style='color:#017575'>Recuperá tu contraseña</h2>"
                + "<p>Hola, <strong>" + user.getFirstName() + "</strong>.</p>"
                + "<p>Recibimos una solicitud para recuperar la contraseña de tu cuenta en <strong>EurekApp</strong>.</p>"
                + "<p>Tu código de recuperación es:</p>"
                + "<div style='background:#f0f4f4;border-radius:8px;padding:16px;text-align:center;margin:16px 0'>"
                + "<span style='font-size:32px;font-weight:bold;letter-spacing:8px;color:#017575'>" + code + "</span>"
                + "</div>"
                + "<p>Ingresá este código en la aplicación para establecer una nueva contraseña.</p>"
                + "<p style='color:#e53935'><strong>Este código expira en 30 minutos.</strong></p>"
                + "<p style='margin-top:32px;color:#638888;font-size:13px'>Si no solicitaste recuperar tu contraseña, ignorá este mensaje.</p>"
                + "</div>";

        try {
            notificationService.sendNotification(email, subject, content);
        } catch (Exception e) {
            log.warn("[action:forgotPassword] No se pudo enviar el email de recuperación a {}: {}", email, e.getMessage());
        }
    }

    public void resetPassword(String email, String token, String newPassword) {
        UserEurekapp user = userRepository.findByUsername(email)
                .orElseThrow(() -> new NotFoundException(
                        ValidationError.USER_NOT_FOUND.getCode(),
                        String.format(ValidationError.USER_NOT_FOUND.getError(), email)));

        if (user.getPasswordResetToken() == null || !token.equals(user.getPasswordResetToken())) {
            throw new BadRequestException(ValidationError.PASSWORD_RESET_TOKEN_INVALID);
        }

        if (LocalDateTime.now().isAfter(user.getPasswordResetTokenExpiry())) {
            throw new BadRequestException(ValidationError.PASSWORD_RESET_TOKEN_EXPIRED);
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setPasswordResetToken(null);
        user.setPasswordResetTokenExpiry(null);
        userRepository.save(user);

        log.info("[action:resetPassword] Contraseña restablecida para {}", email);
    }

    public LoginResponseDto refreshToken(String refreshToken) {
        String username;
        try {
            if (!jwtService.isRefreshToken(refreshToken)) {
                throw new BadRequestException(ValidationError.INVALID_REFRESH_TOKEN);
            }
            username = jwtService.getUsername(refreshToken);
        } catch (JwtException e) {
            log.warn("[action:refreshToken] Refresh token inválido o expirado");
            throw new BadRequestException(ValidationError.INVALID_REFRESH_TOKEN);
        }

        UserEurekapp user = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException(
                        ValidationError.USER_NOT_FOUND.getCode(),
                        String.format(ValidationError.USER_NOT_FOUND.getError(), username)));

        log.info("[action:refreshToken] Token renovado para el usuario {}", username);

        String newJwt = jwtService.generateToken(user);
        return createLoginResponse(user, newJwt);
    }

    // Metodo auxiliar para crear la respuesta del token JWT
    private LoginResponseDto createLoginResponse(UserEurekapp user, String jwt) {
        UserDto userDto = UserDto.builder()
                .username(user.getUsername())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .role(user.getRole().toString())
                .build();

        String refreshToken = jwtService.generateRefreshToken(user);

        LoginResponseDto.LoginResponseDtoBuilder builder = LoginResponseDto.builder()
                .user(userDto)
                .token(jwt)
                .refreshToken(refreshToken);

        Organization organization = user.getOrganization();
        if (organization != null) {
            OrganizationDto organizationDto = OrganizationDto.builder()
                    .id(organization.getId())
                    .name(organization.getName())
                    .contactData(organization.getContactData())
                    .build();
            builder.organization(organizationDto);
        }

        return builder.build();
    }
}