package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.*;
import com.eurekapp.backend.dto.AddEmployeeRequestDto;
import com.eurekapp.backend.dto.response.AddEmployeeRequestListResponseDto;
import com.eurekapp.backend.dto.response.LoginResponseDto;
import com.eurekapp.backend.dto.response.UserListResponseDto;
import com.eurekapp.backend.exception.ForbbidenException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.repository.IAddEmployeeRequestRepository;
import com.eurekapp.backend.repository.IUserRepository;
import lombok.AllArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@AllArgsConstructor
@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);
    private IUserRepository userRepository;
    private IAddEmployeeRequestRepository addEmployeeRequestRepository;

    /*
    * Método usado para obtener todos los empleados de una organización.
    * */
    public UserListResponseDto getOrganizationEmployees(Organization organization) {
        List<UserEurekapp> result = userRepository.findByOrganizationAndRole(organization, Role.ORGANIZATION_EMPLOYEE);

         List<UserDto> userDtos = result.stream()
                                    .map(this::userToDto)
                                    .collect(Collectors.toList());

        return new UserListResponseDto(userDtos);
    }

    /*
    * Método usado para eliminar un empleado de una organización.
    * Esto significa, hacer que el usuario del empleado pase a ser un usuario regular, y que no esté asociado a
    * ninguna organización.
    * */
    public Boolean removeEmployeeFromOrganization(UserEurekapp orgAdmin, Long employeeUserId){
        UserEurekapp employee = userRepository.getReferenceById(employeeUserId);
        if(isAuthorizedToRemoveEmployee(orgAdmin, employee)){
            employee.setRole(Role.USER);
            employee.setOrganization(null);
            userRepository.saveAndFlush(employee);
            log.info("Removed employee from organization");
            return true;
        }
        return false;
    }

    /*
     * Este método es usado para comprobar si un usuario que solicitó eliminar a otro usuario de una organización,
     * efectivamente es el administrador de dicha organización.
     * */
    private Boolean isAuthorizedToRemoveEmployee(UserEurekapp orgAdmin, UserEurekapp employee){
        if(orgAdmin.getRole() == Role.ORGANIZATION_OWNER &&
                orgAdmin.getOrganization().equals(employee.getOrganization()) ){
            return true;
        }
        return false;
    }

    public void addEmployeeToOrganization(UserEurekapp orgAdmin, String employeeUsername) {

        // Verificamos que el usuario que envía la solicitud sea admin de una organización.
        if(orgAdmin.getRole() != Role.ORGANIZATION_OWNER){
            throw new ForbbidenException("forbidden", String.format("No está autorizado a hacer esta solicitud."));
        }

        // Verificamos si el usuario destinatario existe.
        if (!userRepository.existsByUsername(employeeUsername)) {
            throw new NotFoundException("user_not_found", String.format("El usuario con email '%s' no existe.", employeeUsername));
        }

        // Verificamos si el usuario destinatario ya pertenece a una organización.
        UserEurekapp employee = userRepository.getByUsername(employeeUsername);
        if(employee.getOrganization() != null){
            throw new ForbbidenException("user_not_available", String.format("El usuario con email '%s' ya pertenece a una organización.", employeeUsername));
        }

        // Verificamos que el usuario no tenga una solicitud pendiente de esta misma organización.
        List<AddEmployeeRequest> pendingRequests= addEmployeeRequestRepository.findByUserAndOrganizationAndStatus(employee,
                                                    orgAdmin.getOrganization(),
                                                    AddEmployeeRequestStatus.PENDING);
        if(!pendingRequests.isEmpty()){
            throw new ForbbidenException("cannot_send_request", String.format("El usuario con email '%s' ya tiene una solicitud pendiente de tu organización.", employeeUsername));
        }

        // Creamos la solicitud para que el usuario destinatario la pueda ver en su perfil
        AddEmployeeRequest newRequest = AddEmployeeRequest.builder()
                .user(employee)
                .organization(orgAdmin.getOrganization())
                .status(AddEmployeeRequestStatus.PENDING)
                .build();
        addEmployeeRequestRepository.save(newRequest);
    }


    /*
    * Método usado para que un usuario obtenga todas las solicitudes para unirse a una organización que se encuentren
    * pendientes de ser aceptadas o rechazadas.
    */
    public AddEmployeeRequestListResponseDto getAllPendingAddEmployeeRequests(UserEurekapp user) {
        List<AddEmployeeRequest> pendingRequests = addEmployeeRequestRepository.findByUserAndStatus(user,
                                                                    AddEmployeeRequestStatus.PENDING);
        List<AddEmployeeRequestDto> dtos = new ArrayList<>();
        for (AddEmployeeRequest request : pendingRequests) {
            AddEmployeeRequestDto newDto = AddEmployeeRequestDto.builder()
                    .id(request.getId())
                    .organizationName(request.getOrganization().getName())
                    .build();
            dtos.add(newDto);
        }
        AddEmployeeRequestListResponseDto listDto = new AddEmployeeRequestListResponseDto(dtos);

        return listDto;
    }

    /*
    * Método usado para que un usuario acepte una solicitud de una organización para convertirse en empleado.
    */
    public void acceptAddEmployeeRequest(UserEurekapp user, Long addEmployeeRequestId) {

        // Si el rol del usuario no es USER, lanzamos excepción.
        if(!user.getRole().equals(Role.USER)){
            throw new ForbbidenException("forbidden", String.format("No está autorizado a hacer esta solicitud."));
        }

        // Obtenemos la solicitud
        AddEmployeeRequest request = addEmployeeRequestRepository.getReferenceById(addEmployeeRequestId);

        // Si el usuario no coincide con el de la solicitud, lanzamos excepción.
        if(!user.equals(request.getUser())){
            throw new ForbbidenException("forbidden", String.format("No está autorizado a hacer esta solicitud."));
        }

        // Cambiamos el rol del usuario a ORGANIZATION_EMPLOYEE y le asignamos la organización:
        user.setOrganization(request.getOrganization());
        user.setRole(Role.ORGANIZATION_EMPLOYEE);
        userRepository.saveAndFlush(user);

        // Cambiamos el estado de la request a "Aceptada"
        request.setStatus(AddEmployeeRequestStatus.ACCEPTED);
        addEmployeeRequestRepository.save(request);

        // Si el usuario tenía más solicitudes pendientes de tratamiento, automáticamente se las rechaza.
        List<AddEmployeeRequest> otherRequests = addEmployeeRequestRepository.findByUserAndStatus(user,
                AddEmployeeRequestStatus.PENDING);
        for(AddEmployeeRequest req: otherRequests){
            req.setStatus(AddEmployeeRequestStatus.DECLINED);
        }
        addEmployeeRequestRepository.saveAllAndFlush(otherRequests);
    }

    /*
     * Método usado para que un usuario rechace una solicitud de una organización para convertirse en empleado.
     */
    public void declineAddEmployeeRequest(UserEurekapp user, Long addEmployeeRequestId) {
        // Si el rol del usuario no es USER, lanzamos excepción.
        if(!user.getRole().equals(Role.USER)){
            throw new ForbbidenException("forbidden", String.format("No está autorizado a hacer esta solicitud."));
        }

        // Obtenemos la solicitud
        AddEmployeeRequest request = addEmployeeRequestRepository.getReferenceById(addEmployeeRequestId);

        // Si el usuario no coincide con el de la solicitud, lanzamos excepción.
        if(!user.equals(request.getUser())){
            throw new ForbbidenException("forbidden", String.format("No está autorizado a hacer esta solicitud."));
        }

        // Cambiamos el estado de la request a "Rechazada"
        request.setStatus(AddEmployeeRequestStatus.DECLINED);
        addEmployeeRequestRepository.saveAndFlush(request);
    }

    /*
     * Método usado exclusivamente cuando un usuario acepta una solicitud para unirse a una organización. Como al
     * aceptar la solicitud su tipo de usuario y organización cambiaron, entonces deben solicitarse estos detalles
     * nuevamente para poder acceder a las funcionalidades desbloqueadas sin tener que volver a iniciar sesión.
     * */
    public LoginResponseDto refreshUserDetails(UserEurekapp user){

        UserDto userDto = UserDto.builder()
                .username(user.getUsername())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .role(user.getRole().toString())
                .build();

        OrganizationDto orgDto = null;
        if(user.getOrganization() != null) {
            orgDto = OrganizationDto.builder()
                    .id(user.getOrganization().getId())
                    .name(user.getOrganization().getName())
                    .contactData(user.getOrganization().getContactData())
                    .build();
        }

        LoginResponseDto newDetails = LoginResponseDto.builder()
                .user(userDto)
                .organization(orgDto)
                .build();

        return newDetails;
    }

    private UserDto userToDto(UserEurekapp user) {
        UserDto userDto = UserDto.builder()
                .id(user.getId())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .username(user.getUsername())
                .role(user.getRole().toString())
                .build();
        return userDto;
    }


}
