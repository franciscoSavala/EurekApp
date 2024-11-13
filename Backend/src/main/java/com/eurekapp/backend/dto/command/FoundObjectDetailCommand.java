package com.eurekapp.backend.dto.command;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

@Getter
@Setter
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FoundObjectDetailCommand {
    @JsonProperty("foundObjectUUID")
    private String foundObjectUUID;
}
