package com.eurekapp.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AdminUserDto {
    private Long id;
    private String username;
    private String firstName;
    private String lastName;
    private String role;
    private boolean active;
    @JsonProperty("XP")
    private Long XP;
    private Long returnedObjects;
    private String organizationName;
}
