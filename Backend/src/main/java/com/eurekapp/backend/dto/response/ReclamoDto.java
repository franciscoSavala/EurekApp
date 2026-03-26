package com.eurekapp.backend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReclamoDto {
    private Long id;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String comment;
    private Integer starRating;
    private String confidenceLevel;
    private Boolean isSuspicious;

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
    private Double foundObjectLatitude;
    private Double foundObjectLongitude;
    private String b64Json;

    private List<ReclamoHistoryDto> history;
}
