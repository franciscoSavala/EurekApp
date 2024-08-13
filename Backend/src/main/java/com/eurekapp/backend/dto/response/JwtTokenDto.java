package com.eurekapp.backend.dto.response;

import com.eurekapp.backend.dto.OrganizationDto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Builder
@Data
@AllArgsConstructor
@NoArgsConstructor
public class JwtTokenDto {
    private String token;
    private OrganizationDto organization;
}
