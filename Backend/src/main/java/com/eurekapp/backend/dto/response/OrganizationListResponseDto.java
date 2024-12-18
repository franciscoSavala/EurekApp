package com.eurekapp.backend.dto.response;

import com.eurekapp.backend.dto.OrganizationDto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class OrganizationListResponseDto {
    private List<OrganizationDto> organizations;
}
