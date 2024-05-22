package com.eurekapp.backend.service;


import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;

@Service
public class OpenAiEmbeddingModelService {

    private RestClient restClient;

    public OpenAiEmbeddingModelService(RestClient restClient) {
        this.restClient = restClient;
    }

    public List<Double> getEmbedding(String text){
                
    }
}
