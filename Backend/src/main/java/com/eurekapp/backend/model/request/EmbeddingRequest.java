package com.eurekapp.backend.model.request;

import lombok.Getter;

@Getter
public class EmbeddingRequest {
    private final String model = "text-embedding-3-small";
    private final String input;

    public EmbeddingRequest(String input){
        this.input = input;
    }
}
