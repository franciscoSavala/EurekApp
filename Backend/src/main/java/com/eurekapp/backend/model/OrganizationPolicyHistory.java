package com.eurekapp.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "organization_policy_history")
public class OrganizationPolicyHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long organizationId;

    private LocalDateTime changedAt;

    @ManyToOne
    @JoinColumn(name = "changed_by_id")
    private UserEurekapp changedBy;

    @Column(columnDefinition = "TEXT")
    private String previousSnapshot;
}
