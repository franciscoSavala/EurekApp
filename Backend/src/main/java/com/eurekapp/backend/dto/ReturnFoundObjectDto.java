package com.eurekapp.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ReturnFoundObjectDto {
    private String id;
    private String username;
    // EU-362: nombre y apellido de quien retiró el objeto. Null en las devoluciones anteriores al
    // ticket, que se registraron sin pedirlos.
    private String firstName;
    private String lastName;
    private String DNI;
    private String phoneNumber;
    private String personPhoto_b64Json;
    private String foundObjectId;
    private LocalDateTime returnDateTime;
    private String finderEmail;
    private String finderFullName;
    private String finderRole;
    private Boolean rewardExcluded;
    private String rewardExclusionMessage;
}

