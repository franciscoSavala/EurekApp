package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.response.AchievementsResponseDto;
import com.eurekapp.backend.dto.response.LoginResponseDto;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.service.AchievementsService;
import com.eurekapp.backend.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/user")
@CrossOrigin("*")
public class UserController {
    @Autowired
    private UserService userService;

    @Autowired
    private AchievementsService achievementsService;

    /*
    * Endpoint usado exclusivamente cuando un usuario acepta una solicitud para unirse a una organización. Como al
    * aceptar la solicitud su tipo de usuario y organización cambiaron, entonces deben solicitarse estos detalles
    * nuevamente para poder acceder a las funcionalidades desbloqueadas sin tener que volver a iniciar sesión.
    * */
    @GetMapping("/refreshUserDetails")
    public ResponseEntity<LoginResponseDto> refreshUserDetails(@AuthenticationPrincipal UserEurekapp user) {
        return ResponseEntity.ok(userService.refreshUserDetails(user));
    }

    /*
    * Endpoint usado cuando un usuario cualquiera accede a la pestaña "Logros". Devuelve los XP del usuario, nivel al que
    * pertenece, puntos hasta el próximo nivel, y logros obtenidos.
    * */
    @GetMapping("/achievements")
    public ResponseEntity<AchievementsResponseDto> getAchievements(@AuthenticationPrincipal UserEurekapp user) {
        return ResponseEntity.ok(achievementsService.getAchievements(user));
    }

}