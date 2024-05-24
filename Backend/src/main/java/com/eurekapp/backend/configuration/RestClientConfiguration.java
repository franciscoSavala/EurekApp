package com.eurekapp.backend.configuration;

import io.pinecone.clients.Index;
import io.pinecone.clients.Pinecone;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfiguration {


    @Bean
    @Qualifier("embeddingClient")
    public RestClient embeddingClient(
            @Value("${application.openai.api.key}") String apiKey
    ){
        return RestClient.builder()
                .baseUrl("https://api.openai.com/v1/embeddings")
                .defaultHeader("Authorization", String.format("Bearer %s", apiKey))
                .build();
    }

    @Bean
    @Qualifier("completitionClient")
    public RestClient completitionClient(
            @Value("${application.openai.api.key}") String apiKey
    ){
        return RestClient.builder()
                .baseUrl("https://api.openai.com/v1/chat/completions")
                .defaultHeader("Authorization", String.format("Bearer %s", apiKey))
                .build();
    }

    @Bean
    public Pinecone pinecone(
            @Value("${application.pinecone.api.key}") String apiKey
    ){
        return new Pinecone.Builder(apiKey).build();
    }

    @Bean
    public Index index(Pinecone pinecone){
        return pinecone.getIndexConnection("eurekapp");
    }
}
