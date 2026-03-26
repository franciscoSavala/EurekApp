package com.eurekapp.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

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

    @ManyToOne
    @JoinColumn(name = "suspect_user_id", nullable = true)
    private UserEurekapp suspectUser;

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
}
