package com.eurekapp.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "organization_policies")
public class OrganizationPolicy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "organization_id", unique = true)
    private Organization organization;

    private Integer maxStorageDays;

    private Boolean requiresIdentityValidation;

    @Column(length = 500)
    private String identityValidationDetails;

    @Enumerated(EnumType.STRING)
    private DeliveryProcess deliveryProcess;

    private Boolean requiresAdditionalEvidence;

    @Column(length = 500)
    private String additionalEvidenceDetails;

    @Column(length = 500)
    private String strictControlCategories;

    private Boolean notifyOnMatch;

    @Column(length = 500)
    private String rewardPolicy;

    @Enumerated(EnumType.STRING)
    private OrganizationType organizationType;
}
