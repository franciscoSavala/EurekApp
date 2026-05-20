package com.eurekapp.backend.dto.response;

import com.eurekapp.backend.model.RewardExclusion;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class RewardExclusionDto {

    private Long id;
    private String foundObjectUUID;
    private String username;
    private String userRole;
    private String reason;
    private LocalDateTime excludedAt;
    private String organizationId;

    public static RewardExclusionDto from(RewardExclusion exclusion) {
        return RewardExclusionDto.builder()
                .id(exclusion.getId())
                .foundObjectUUID(exclusion.getFoundObjectUUID())
                .username(exclusion.getUser().getUsername())
                .userRole(exclusion.getUserRole().name())
                .reason(exclusion.getReason())
                .excludedAt(exclusion.getExcludedAt())
                .organizationId(exclusion.getOrganizationId())
                .build();
    }
}
