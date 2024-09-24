package com.eurekapp.backend.model;

import jakarta.validation.constraints.AssertTrue;
import lombok.Builder;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Getter
@Setter
@Data
@Builder
public class SimilarObjectsCommand {
    private String query;
    private Long organizationId;
    private LocalDateTime lostDate;
}
