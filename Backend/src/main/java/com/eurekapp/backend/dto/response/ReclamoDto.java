package com.eurekapp.backend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReclamoDto {
    private Long id;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String comment;
    private String claimDescription;
    private Integer starRating;
    private String confidenceLevel;

    private Long userId;
    private String userEmail;
    private String userFullName;

    private String foundObjectUUID;
    private String foundObjectTitle;
    private String foundObjectCategory;
    private String foundObjectHumanDescription;
    private String foundObjectAiDescription;
    private LocalDateTime foundObjectDate;
    private String foundObjectOrganizationId;
    private String foundObjectOrganizationName;
    private String foundObjectStreet;
    private String foundObjectStreetNumber;
    private Double foundObjectLatitude;
    private Double foundObjectLongitude;
    private String b64Json;

    private String finderEmail;
    private String finderFullName;
    private String finderRole;
    private Boolean rewardExcluded;
    private String rewardExclusionReason;
}
