package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.command.AddEmployeeCommand;
import com.eurekapp.backend.dto.command.AddEmployeeRequestCommand;
import com.eurekapp.backend.dto.command.AssignEncargadoCommand;
import com.eurekapp.backend.dto.command.DeleteEmployeeCommand;
import com.eurekapp.backend.dto.command.SignUpOrganizationCommand;
import com.eurekapp.backend.dto.response.AddEmployeeRequestListResponseDto;
import com.eurekapp.backend.dto.response.OrganizationListResponseDto;
import com.eurekapp.backend.dto.response.UserListResponseDto;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.service.OrganizationService;
import com.eurekapp.backend.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/organizations")
@CrossOrigin("*")
@Tag(name = "Organizaciones", description = "Gestión de organizaciones y sus empleados")
@SecurityRequirement(name = "bearerAuth")
public class OrganizationController {

    @Autowired
    private OrganizationService organizationService;

    @Autowired
    private UserService userService;

    @GetMapping
    @Operation(summary = "Listar organizaciones", description = "Devuelve todas las organizaciones registradas en la plataforma.")
    public ResponseEntity<OrganizationListResponseDto> findAllOrganizations() {
        return ResponseEntity.ok(organizationService.getAllOrganizations());
    }

    @PostMapping
    @Operation(summary = "Registrar organización", description = "Da de alta una nueva organización en la plataforma.")
    public ResponseEntity<Void> signUpOrganization(@RequestBody @Valid SignUpOrganizationCommand signUpOrganization) {
        organizationService.signUpOrganization(signUpOrganization);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/employees")
    @Operation(summary = "Listar empleados de la organización",
            description = "Devuelve todos los empleados de la organización del usuario autenticado. Solo accesible para ORGANIZATION_OWNER.")
    public ResponseEntity<UserListResponseDto> getOrganizationEmployees(@AuthenticationPrincipal UserEurekapp user) {
        if (user.getRole() == Role.ORGANIZATION_OWNER) {
            return ResponseEntity.ok(userService.getOrganizationEmployees(user.getOrganization()));
        }
        return ResponseEntity.badRequest().build();
    }

    @PostMapping("/delete_employee")
    @Operation(summary = "Desvincular empleado",
            description = "Elimina a un empleado de la organización, devolviendo su cuenta al rol USER. Solo para ORGANIZATION_OWNER.")
    public ResponseEntity<Void> deleteEmployee(@AuthenticationPrincipal UserEurekapp orgAdmin,
                                               @RequestBody DeleteEmployeeCommand command) {
        Boolean successful = userService.removeEmployeeFromOrganization(orgAdmin, command.getUserId());
        return successful ? ResponseEntity.ok().build() : ResponseEntity.badRequest().build();
    }

    @PostMapping("/add_employee")
    @Operation(summary = "Invitar empleado",
            description = "Envía una solicitud de vinculación a un usuario para que se una a la organización como empleado.")
    public ResponseEntity<Void> addEmployee(@AuthenticationPrincipal UserEurekapp orgAdmin,
                                            @RequestBody AddEmployeeCommand command) {
        userService.addEmployeeToOrganization(orgAdmin, command.getEmployeeUsername());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/getPendingAddEmployeeRequests")
    @Operation(summary = "Ver solicitudes de vinculación pendientes",
            description = "Devuelve todas las solicitudes de unión a una organización que están pendientes de respuesta para el usuario autenticado.")
    public ResponseEntity<AddEmployeeRequestListResponseDto> getPendingAddEmployeeRequests(@AuthenticationPrincipal UserEurekapp user) {
        return ResponseEntity.ok(userService.getAllPendingAddEmployeeRequests(user));
    }

    @PostMapping("/acceptAddEmployeeRequest")
    @Operation(summary = "Aceptar solicitud de vinculación",
            description = "El usuario acepta unirse a una organización como empleado. Su rol cambia a ORGANIZATION_EMPLOYEE.")
    public ResponseEntity<Void> acceptAddEmployeeRequest(@AuthenticationPrincipal UserEurekapp user,
                                                         @RequestBody AddEmployeeRequestCommand command) {
        userService.acceptAddEmployeeRequest(user, command.getId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/assign_encargado")
    @Operation(summary = "Asignar rol de encargado",
            description = "Asigna el rol de encargado a un empleado de la organización. Solo para ORGANIZATION_OWNER.")
    public ResponseEntity<Void> assignEncargado(@AuthenticationPrincipal UserEurekapp orgAdmin,
                                                @RequestBody AssignEncargadoCommand command) {
        userService.assignEncargado(orgAdmin, command.getUserId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/revoke_encargado")
    @Operation(summary = "Revocar rol de encargado",
            description = "Revoca el rol de encargado de un empleado, dejándolo como empleado básico. Solo para ORGANIZATION_OWNER.")
    public ResponseEntity<Void> revokeEncargado(@AuthenticationPrincipal UserEurekapp orgAdmin,
                                                @RequestBody AssignEncargadoCommand command) {
        userService.revokeEncargado(orgAdmin, command.getUserId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/declineAddEmployeeRequest")
    @Operation(summary = "Rechazar solicitud de vinculación",
            description = "El usuario rechaza la solicitud de unirse a una organización.")
    public ResponseEntity<Void> declineAddEmployeeRequest(@AuthenticationPrincipal UserEurekapp user,
                                                          @RequestBody AddEmployeeRequestCommand command) {
        userService.declineAddEmployeeRequest(user, command.getId());
        return ResponseEntity.ok().build();
    }
}
