package com.eurekapp.backend.dto.response;

import com.eurekapp.backend.dto.OrganizationDto;
import com.eurekapp.backend.dto.UserDto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Builder
@Data
@AllArgsConstructor
@NoArgsConstructor
public class LoginResponseDto {
    private String token;
    private UserDto user;
    private OrganizationDto organization;
}
