package com.eurekapp.backend.model;

import lombok.*;

@Getter
@Setter
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GetReturnFoundObjectCommand {
    private String foundObjectUUID;
}