package com.eurekapp.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.ColumnDefault;

@Entity
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "organizations")
public class Organization {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;
    private String contactData;
    private String street;
    private String streetNumber;
    private String city;
    private String province;
    private String country;

    @Enumerated(EnumType.STRING)
    @Column(name = "organization_type", length = 50)
    private OrganizationType organizationType;

    @Embedded
    private GeoCoordinates coordinates;

    @ColumnDefault("1")
    @Column(name = "active", nullable = false, columnDefinition = "TINYINT(1) NOT NULL DEFAULT 1")
    @Builder.Default
    private boolean active = true;
}
