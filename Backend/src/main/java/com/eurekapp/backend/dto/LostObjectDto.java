package com.eurekapp.backend.dto;


import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@NoArgsConstructor
@AllArgsConstructor
@Data
@Builder
public class LostObjectDto {
    private String id;
    private String description;
    private String username;
    private LocalDateTime lost_date;
}
