package com.eurekapp.backend.model.response;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Setter
@Getter
@AllArgsConstructor
@NoArgsConstructor
public class ChatCompletitionResponse {
    private String id;
    private String object;
    private long created;
    private String model;
    private List<ChatResponseChoices> choices;
}
