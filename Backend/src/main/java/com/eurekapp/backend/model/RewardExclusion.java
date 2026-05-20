package com.eurekapp.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "reward_exclusions")
public class RewardExclusion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String foundObjectUUID;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private UserEurekapp user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role userRole;

    /** Motivo de la exclusión. Valor fijo: "INCOMPATIBLE_ROLE" */
    @Column(nullable = false, length = 100)
    private String reason;

    @Column(nullable = false)
    private LocalDateTime excludedAt;

    @Column(nullable = false)
    private String organizationId;
}
