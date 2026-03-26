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
@Table(name = "reclamos")
public class Reclamo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", length = 36)
    private String organizationId;

    @Column(name = "found_object_uuid", length = 36)
    private String foundObjectUUID;

    @Column(name = "found_object_category", length = 100)
    private String foundObjectCategory;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private UserEurekapp user;

    @Column(length = 500)
    private String comment;

    private Integer starRating;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ClaimStatus status;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "search_feedback_id")
    private Long searchFeedbackId;
}
