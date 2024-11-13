package com.eurekapp.backend.dto.command;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Email;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SignUpOrganizationCommand {
    @JsonProperty("contact_email")
    @Email
    private String contactEmail;
    @JsonProperty("request_data")
    private String requestData;
}
