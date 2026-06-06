package com.eurekapp.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "organization_request")
public class OrganizationRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "requesting_user_id", nullable = false)
    private UserEurekapp requestingUser;

    @Column(name = "organization_name", nullable = false, length = 200)
    private String organizationName;

    @Enumerated(EnumType.STRING)
    @Column(name = "organization_type", nullable = false, length = 50)
    private OrganizationType organizationType;

    @Column(name = "custom_organization_type", length = 200)
    private String customOrganizationType;

    @Column(name = "street", nullable = false, length = 200)
    private String street;

    @Column(name = "street_number", nullable = false, length = 20)
    private String streetNumber;

    @Column(name = "city", nullable = false, length = 100)
    private String city;

    @Column(name = "province", nullable = false, length = 100)
    private String province;

    @Column(name = "country", nullable = false, length = 100)
    private String country;

    @Embedded
    private GeoCoordinates coordinates;

    @Column(name = "owner_first_name", nullable = false, length = 100)
    private String ownerFirstName;

    @Column(name = "owner_last_name", nullable = false, length = 100)
    private String ownerLastName;

    @Column(name = "owner_email", nullable = false, length = 150)
    private String ownerEmail;

    @Column(name = "owner_phone", nullable = false, length = 50)
    private String ownerPhone;

    @Column(name = "reason", nullable = false, length = 1000)
    private String reason;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private OrganizationRequestStatus status;

    @Column(name = "created_at", nullable = false, columnDefinition = "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;
}
