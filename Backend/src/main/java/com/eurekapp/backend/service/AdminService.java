package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.response.AdminUserDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.ForbiddenException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IUserRepository;
import lombok.AllArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

@AllArgsConstructor
@Service
public class AdminService {

    private static final Logger log = LoggerFactory.getLogger(AdminService.class);

    private final IUserRepository userRepository;

    public List<AdminUserDto> getUsers(UserEurekapp admin, String roleFilter) {
        if (admin.getRole() != Role.ADMIN) {
            throw new ForbiddenException("forbidden", "Solo el administrador puede acceder a esta sección.");
        }
        List<UserEurekapp> users;
        if (roleFilter != null && !roleFilter.isBlank()) {
            Role role = Role.valueOf(roleFilter.toUpperCase());
            users = userRepository.findAllByRole(role);
        } else {
            users = userRepository.findAll();
        }
        return users.stream().map(this::toAdminUserDto).toList();
    }

    public void toggleUserActive(UserEurekapp admin, Long userId, boolean active) {
        if (admin.getRole() != Role.ADMIN) {
            throw new ForbiddenException("forbidden", "Solo el administrador puede modificar usuarios.");
        }
        UserEurekapp target = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("user_not_found", "Usuario no encontrado."));
        if (userId.equals(admin.getId())) {
            throw new BadRequestException("cannot_deactivate_self",
                    "No podés desactivarte a vos mismo.");
        }
        target.setActive(active);
        userRepository.save(target);
        log.info("[action:toggleUserActive] Admin {} set active={} for user {}",
                admin.getUsername(), active, target.getUsername());
    }

    private AdminUserDto toAdminUserDto(UserEurekapp user) {
        return AdminUserDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .role(user.getRole().name())
                .active(user.isActive())
                .XP(user.getXP())
                .returnedObjects(user.getReturnedObjects())
                .organizationName(user.getOrganization() != null ? user.getOrganization().getName() : null)
                .build();
    }
}
