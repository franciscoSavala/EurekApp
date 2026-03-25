package com.eurekapp.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "search_feedback")
public class SearchFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = true, length = 36)
    private String organizationId;

    @Column(name = "found_object_uuid", nullable = true, length = 36)
    private String foundObjectUUID;     // null si el usuario no encontró su objeto

    @Column(name = "star_rating", nullable = false)
    private Integer starRating;         // 1-5

    @Column(name = "was_found", nullable = false)
    private Boolean wasFound;           // true = "este es mi objeto"

    @Column(name = "comment", nullable = true, length = 500)
    private String comment;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = true)
    private UserEurekapp user;
}
