package com.eurekapp.backend.dto.request;

import lombok.Getter;


/* El propósito de esta clase es encapsular los datos que se enviarán en las request a la API de Open AI Embeddings, la
    cual es usada para obtener la representación vectorial de un texto. */
@Getter
public class EmbeddingRequest {
    private final String model = "text-embedding-3-small";

    /* La API de OpenAI acepta en "input" tanto un texto suelto como una lista de textos (batch), y
       devuelve un vector por cada uno. Por eso el campo es Object: los dos constructores emiten el
       mismo JSON que espera la API, sin duplicar la clase. */
    private final Object input;

    public EmbeddingRequest(String input){
        this.input = input;
    }

    public EmbeddingRequest(java.util.List<String> inputs){
        this.input = inputs;
    }
}
