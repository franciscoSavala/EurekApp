package com.eurekapp.backend.dto.request;

import lombok.Getter;

@Getter
public class EmbeddingRequest {
    private final String model = "text-embedding-3-small";
    private final String input;

    public EmbeddingRequest(String input){
        this.input = input;
    }
}
