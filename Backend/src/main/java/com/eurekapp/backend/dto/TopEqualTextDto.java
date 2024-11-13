package com.eurekapp.backend.dto;

import com.eurekapp.backend.dto.response.TextResponseDto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TopEqualTextDto {
    private List<TextResponseDto> textList;
}
