package com.eurekapp.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "usability_feedback")
public class UsabilityFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "star_rating", nullable = false)
    private Integer starRating;     // 1–5

    @Column(name = "aspects", nullable = true, length = 200)
    private String aspects;         // Ej: "FACILIDAD_USO,CLARIDAD,NAVEGACION"

    @Column(name = "comment", nullable = true, length = 500)
    private String comment;

    @Column(name = "context", nullable = true, length = 100)
    private String context;         // Ej: "upload_object", "profile"

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = true)
    private UserEurekapp user;
}
