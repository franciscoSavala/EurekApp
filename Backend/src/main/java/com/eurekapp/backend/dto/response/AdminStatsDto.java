package com.eurekapp.backend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AdminStatsDto {
    private Long totalUsers;
    private Long activeUsers;
    private Long userUsers;
    private Long orgOwnerUsers;
    private Long orgEmployeeUsers;
    private Long encargadoUsers;
    private Long adminUsers;

    private Long totalOrgs;
    private Long activeOrgs;

    private Long totalFoundObjects;
    private Long returnedFoundObjects;

    private Long orgRequestsPending;
    private Long orgRequestsApproved;
    private Long orgRequestsRejected;
}
