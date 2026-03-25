package com.eurekapp.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SocialLoginRequestDto {
    @NotBlank
    private String provider;  // "GOOGLE" o "FACEBOOK"
    @NotBlank
    private String idToken;   // idToken (Google) o accessToken (Facebook)
}
