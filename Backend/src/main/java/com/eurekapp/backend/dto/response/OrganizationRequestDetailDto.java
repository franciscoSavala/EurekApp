package com.eurekapp.backend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class OrganizationRequestDetailDto {
    private Long id;
    private String organizationName;
    private String organizationType;
    private String customOrganizationType;
    private String street;
    private String streetNumber;
    private String city;
    private String province;
    private String country;
    private Double latitude;
    private Double longitude;
    private String ownerFirstName;
    private String ownerLastName;
    private String ownerEmail;
    private String ownerPhone;
    private String reason;
    private String status;
    private LocalDateTime createdAt;
    private String requestingUserEmail;
    private String requestingUserFirstName;
    private String requestingUserLastName;
}
