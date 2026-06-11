package com.eurekapp.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "fraud_alert")
public class FraudAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false, length = 36)
    private String organizationId;

    @Column(name = "found_object_uuid", nullable = true, length = 36)
    private String foundObjectUUID;

    // DNI de quien retira el objeto: clave de agrupación común a las tres reglas de fraude.
    @Column(name = "dni", nullable = true, length = 20)
    private String dni;

    // Usuarios a bloquear por esta alerta. Una alerta puede señalar a varias personas a la
    // vez (p. ej. quien encontró el objeto + quien lo retiró + el empleado que lo entregó).
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "fraud_alert_suspect_user",
            joinColumns = @JoinColumn(name = "fraud_alert_id"),
            inverseJoinColumns = @JoinColumn(name = "user_id"))
    @Builder.Default
    private Set<UserEurekapp> suspectUsers = new HashSet<>();

    // Empleado de la org que registró la devolución que disparó la alerta (contexto / Caso 3).
    @ManyToOne
    @JoinColumn(name = "returned_by_employee_id", nullable = true)
    private UserEurekapp returnedByEmployee;

    @Column(name = "reason", nullable = false, length = 60)
    private String reason;

    @Column(name = "details", nullable = true, length = 500)
    private String details;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private FraudAlertStatus status;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "resolved_at", nullable = true)
    private LocalDateTime resolvedAt;

    @ManyToOne
    @JoinColumn(name = "resolved_by_id", nullable = true)
    private UserEurekapp resolvedBy;

    // Clave de deduplicación: identifica el grupo concreto que disparó la regla (el DNI, el par
    // finder+DNI, etc.). Junto con 'reason' y la ventana de tiempo evita crear alertas repetidas.
    @Column(name = "dedup_key", nullable = true, length = 255)
    private String dedupKey;
}
