package com.eurekapp.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "fraud_block")
public class FraudBlock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // DNI bloqueado (nulo si el bloqueo es solo sobre un usuario registrado)
    @Column(name = "target_dni", nullable = true, length = 20)
    private String targetDni;

    // Usuario bloqueado (nulo si el bloqueo es solo sobre un DNI sin cuenta)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_user_id", nullable = true)
    private UserEurekapp targetUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fraud_alert_id", nullable = false)
    private FraudAlert fraudAlert;

    @Column(name = "blocked_at", nullable = false)
    private LocalDateTime blockedAt;

    // Calculado como blockedAt + T días en el momento de crear el bloqueo
    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;
}
