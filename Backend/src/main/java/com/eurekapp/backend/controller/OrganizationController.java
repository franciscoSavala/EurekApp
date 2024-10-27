package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.*;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.service.OrganizationService;
import com.eurekapp.backend.service.UserService;
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


}
