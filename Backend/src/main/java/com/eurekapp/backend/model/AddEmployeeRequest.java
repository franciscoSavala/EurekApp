package com.eurekapp.backend.model;


import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "add_employee_request")
public class AddEmployeeRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Usuario de la persona que un admin pretende añadir como empleado.
    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private UserEurekapp user;

    // Organización a la que se lo pretende agregar como empleado.
    @ManyToOne
    @JoinColumn(name = "org_id", nullable = false)
    private Organization organization;

    // Estado de la solicitud
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private AddEmployeeRequestStatus status;
}
