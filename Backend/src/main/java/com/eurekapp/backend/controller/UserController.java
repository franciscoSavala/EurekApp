package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.request.UpdateProfileDto;
import com.eurekapp.backend.dto.response.AchievementsResponseDto;
import com.eurekapp.backend.dto.response.LoginResponseDto;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.service.AchievementsService;
import com.eurekapp.backend.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/user")
@CrossOrigin("*")
@Tag(name = "Usuario", description = "Perfil, logros y actualización de datos del usuario autenticado")
@SecurityRequirement(name = "bearerAuth")
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private AchievementsService achievementsService;

    @GetMapping("/refreshUserDetails")
    @Operation(summary = "Refrescar datos del usuario",
            description = "Devuelve los datos actualizados del usuario (rol, organización, XP). Usar luego de aceptar una solicitud de vinculación a una organización.")
    public ResponseEntity<LoginResponseDto> refreshUserDetails(@AuthenticationPrincipal UserEurekapp user) {
        return ResponseEntity.ok(userService.refreshUserDetails(user));
    }

    @PutMapping("/profile")
    @Operation(summary = "Editar nombre y apellido",
            description = "Actualiza nombre y apellido del usuario autenticado (1 a 50 caracteres cada uno). El email no se modifica. Devuelve los datos refrescados del usuario.")
    public ResponseEntity<LoginResponseDto> updateProfile(@AuthenticationPrincipal UserEurekapp user,
                                                          @RequestBody UpdateProfileDto dto) {
        return ResponseEntity.ok(userService.updateProfile(user, dto.getFirstName(), dto.getLastName()));
    }

    @GetMapping("/achievements")
    @Operation(summary = "Obtener logros",
            description = "Devuelve el XP del usuario, su nivel actual, los puntos hasta el siguiente nivel y los logros desbloqueados.")
    public ResponseEntity<AchievementsResponseDto> getAchievements(@AuthenticationPrincipal UserEurekapp user) {
        return ResponseEntity.ok(achievementsService.getAchievements(user));
    }
}
