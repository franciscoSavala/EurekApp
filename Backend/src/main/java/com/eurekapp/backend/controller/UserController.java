package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.*;
import com.eurekapp.backend.dto.response.LoginResponseDto;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.service.IFoundObjectService;
import com.eurekapp.backend.service.ReturnFoundObjectService;
import com.eurekapp.backend.service.UserService;
import jakarta.validation.constraints.Past;
import org.hibernate.validator.constraints.Length;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/user")
@CrossOrigin("*")
public class UserController {
    @Autowired
    private UserService userService;

    /*
    * Endpoint usado exclusivamente cuando un usuario acepta una solicitud para unirse a una organización. Como al
    * aceptar la solicitud su tipo de usuario y organización cambiaron, entonces deben solicitarse estos detalles
    * nuevamente para poder acceder a las funcionalidades desbloqueadas sin tener que volver a iniciar sesión.
    * */
    @GetMapping("/refreshUserDetails")
    public ResponseEntity<LoginResponseDto> refreshUserDetails(@AuthenticationPrincipal UserEurekapp user) {
        return ResponseEntity.ok(userService.refreshUserDetails(user));
    }

}