package com.eurekapp.backend.dto.command;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddEmployeeRequestCommand {
    @JsonProperty("requestId")
    private Long id;
}
