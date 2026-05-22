package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.response.InAppNotificationDto;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.service.InAppNotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/notifications")
@CrossOrigin("*")
@AllArgsConstructor
@Tag(name = "Notifications", description = "Notificaciones in-app del usuario")
@SecurityRequirement(name = "bearerAuth")
public class NotificationController {

    private final InAppNotificationService notificationService;

    @GetMapping
    @Operation(summary = "Obtener notificaciones", description = "Retorna todas las notificaciones del usuario autenticado.")
    public ResponseEntity<List<InAppNotificationDto>> getNotifications(
            @AuthenticationPrincipal UserEurekapp user) {
        return ResponseEntity.ok(notificationService.getNotificationsForUser(user));
    }

    @GetMapping("/unread-count")
    @Operation(summary = "Cantidad de notificaciones no leídas")
    public ResponseEntity<Map<String, Long>> getUnreadCount(
            @AuthenticationPrincipal UserEurekapp user) {
        return ResponseEntity.ok(Map.of("count", notificationService.getUnreadCount(user)));
    }

    @PostMapping("/{id}/read")
    @Operation(summary = "Marcar notificación como leída")
    public ResponseEntity<Void> markAsRead(
            @AuthenticationPrincipal UserEurekapp user,
            @PathVariable Long id) {
        notificationService.markAsRead(user, id);
        return ResponseEntity.ok().build();
    }
}
