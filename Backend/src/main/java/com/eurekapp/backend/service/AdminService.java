package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.response.AdminOrganizationDto;
import com.eurekapp.backend.dto.response.AdminUserDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.ForbiddenException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.IUserRepository;
import com.eurekapp.backend.service.notification.NotificationService;
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
    private final IOrganizationRepository organizationRepository;
    private final InAppNotificationService inAppNotificationService;
    private final NotificationService notificationService;
    private final EmailTemplateService emailTemplateService;

    // ── Usuarios ──────────────────────────────────────────────────────────────

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

    // ── Organizaciones ────────────────────────────────────────────────────────

    public List<AdminOrganizationDto> getOrganizations(UserEurekapp admin) {
        if (admin.getRole() != Role.ADMIN) {
            throw new ForbiddenException("forbidden", "Solo el administrador puede acceder a esta sección.");
        }
        return organizationRepository.findAll().stream()
                .map(this::toAdminOrganizationDto)
                .toList();
    }

    public void toggleOrganizationActive(UserEurekapp admin, Long orgId, boolean active) {
        if (admin.getRole() != Role.ADMIN) {
            throw new ForbiddenException("forbidden", "Solo el administrador puede modificar organizaciones.");
        }
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new NotFoundException("org_not_found", "Organización no encontrada."));
        org.setActive(active);
        organizationRepository.save(org);
        log.info("[action:toggleOrganizationActive] Admin {} set active={} for org {}",
                admin.getUsername(), active, org.getName());

        List<UserEurekapp> members = userRepository.findByOrganizationAndRoleIn(
                org, List.of(Role.ORGANIZATION_OWNER, Role.ORGANIZATION_EMPLOYEE, Role.ENCARGADO));

        String notifType  = active ? "ORG_REACTIVATED" : "ORG_DEACTIVATED";
        String notifTitle = active ? "Tu organización fue reactivada" : "Tu organización fue suspendida";
        String notifDesc  = active
                ? "La organización \"" + org.getName() + "\" volvió a operar en EurekApp."
                : "La organización \"" + org.getName() + "\" fue suspendida por el administrador. Tu sesión será cerrada.";
        String emailSubject = active
                ? "EurekApp — Tu organización fue reactivada"
                : "EurekApp — Tu organización fue suspendida";

        for (UserEurekapp member : members) {
            inAppNotificationService.createNotification(member, notifTitle, notifDesc, notifType, null);
            try {
                String emailBody = active
                        ? emailTemplateService.buildOrgReactivatedEmail(member.getFirstName(), org.getName())
                        : emailTemplateService.buildOrgDeactivatedEmail(member.getFirstName(), org.getName());
                notificationService.sendNotification(member.getUsername(), emailSubject, emailBody);
            } catch (Exception e) {
                log.warn("No se pudo enviar email a {}: {}", member.getUsername(), e.getMessage());
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

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

    private AdminOrganizationDto toAdminOrganizationDto(Organization org) {
        int employeeCount = userRepository.findByOrganizationAndRoleIn(
                org, List.of(Role.ORGANIZATION_OWNER, Role.ORGANIZATION_EMPLOYEE, Role.ENCARGADO)).size();
        return AdminOrganizationDto.builder()
                .id(org.getId())
                .name(org.getName())
                .contactData(org.getContactData())
                .city(org.getCity())
                .province(org.getProvince())
                .organizationType(org.getOrganizationType() != null ? org.getOrganizationType().name() : null)
                .active(org.isActive())
                .employeeCount(employeeCount)
                .build();
    }
}
