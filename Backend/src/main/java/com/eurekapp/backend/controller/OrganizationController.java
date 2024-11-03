package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.*;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.service.OrganizationService;
import com.eurekapp.backend.service.UserService;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/organizations")
@CrossOrigin("*")
public class OrganizationController {

    @Autowired
    private OrganizationService organizationService;

    @Autowired
    private UserService userService;

    @GetMapping
    public ResponseEntity<OrganizationListResponseDto> findAllOrganizations() {
        return ResponseEntity.ok(organizationService.getAllOrganizations());
    }

    @PostMapping
    public ResponseEntity<Void> signUpOrganization(@RequestBody @Valid SignUpOrganizationCommand signUpOrganization){
        organizationService.signUpOrganization(signUpOrganization);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/employees")
    public ResponseEntity<UserListResponseDto> getOrganizationEmployees(@AuthenticationPrincipal UserEurekapp user){
        if(user.getRole() == Role.ORGANIZATION_OWNER){
            return ResponseEntity.ok(userService.getOrganizationEmployees(user.getOrganization()));
        }
        return ResponseEntity.badRequest().build();
    }

    /*
    * Endpoint usado por un administrador de organización para desvincular la cuenta de un empleado, haciendo que el
    * mismo vuelva a ser un usuario regular.
    * */
    @PostMapping("/delete_employee")
    public ResponseEntity<Void> deleteEmployee(@AuthenticationPrincipal UserEurekapp orgAdmin,
                                               @RequestBody(required = true) DeleteEmployeeCommand command){
        Long userId = command.getUserId();
        Boolean succesful = userService.removeEmployeeFromOrganization(orgAdmin, userId);
        if(succesful){
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.badRequest().build();
    }

    /*
     * Endpoint usado por un administrador de organización para agregar a un empleado.
     * */
    @PostMapping("/add_employee")
    public ResponseEntity<Void> addEmployee(@AuthenticationPrincipal UserEurekapp orgAdmin,
                                               @RequestBody(required = true) AddEmployeeCommand command){
            String employeeUsername = command.getEmployeeUsername();
            userService.addEmployeeToOrganization(orgAdmin, employeeUsername);
            return ResponseEntity.ok().build();
    }

    /*
    * Endpoint usado por un usuario regular para obtener todas las solicitudes de unión a una organización, que estén
    * pendientes de tratamiento (o sea, sin aceptar ni rechazar)
     */
    @GetMapping("/getPendingAddEmployeeRequests")
    public ResponseEntity<AddEmployeeRequestListResponseDto> getPendingAddEmployeeRequests(@AuthenticationPrincipal UserEurekapp user){
        return ResponseEntity.ok(userService.getAllPendingAddEmployeeRequests(user));
    }

    /*
    * Endpoint usado por un usuario regular para aceptar una solicitud de unión a una organización.
    * */
    @PostMapping("/acceptAddEmployeeRequest")
    public ResponseEntity<Void> acceptAddEmployeeRequest(@AuthenticationPrincipal UserEurekapp user,
                                                         @RequestBody(required = true) AddEmployeeRequestCommand command){
        userService.acceptAddEmployeeRequest(user, command.getId());
        return ResponseEntity.ok().build();
    }

    /*
     * Endpoint usado por un usuario regular para rechazar una solicitud de unión a una organización.
     * */
    @PostMapping("/declineAddEmployeeRequest")
    public ResponseEntity<Void> declineAddEmployeeRequest(@AuthenticationPrincipal UserEurekapp user,
                                                         @RequestBody(required = true) AddEmployeeRequestCommand command){
        userService.declineAddEmployeeRequest(user, command.getId());
        return ResponseEntity.ok().build();
    }

}
