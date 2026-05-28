package com.eurekapp.backend.dto.request;

import lombok.Data;

@Data
public class CreateReclamoRequestDto {
    private String foundObjectUUID;
    private String organizationId;
    private String claimDescription;
}
