package com.eurekapp.backend.dto.request;

import lombok.Getter;


/* El propósito de esta clase es encapsular los datos que se enviarán en las request a la API de Open AI Embeddings, la
    cual es usada para obtener la representación vectorial de un texto. */
@Getter
public class EmbeddingRequest {
    private final String model = "text-embedding-3-small";
    private final String input;

    public EmbeddingRequest(String input){
        this.input = input;
    }
}
