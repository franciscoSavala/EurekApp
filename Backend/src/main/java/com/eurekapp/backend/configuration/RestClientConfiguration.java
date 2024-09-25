package com.eurekapp.backend.configuration;

import io.pinecone.clients.Index;
import io.pinecone.clients.Pinecone;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.web.client.RestClient;


// Clase que maneja las configuraciones de las conexiones a los servicios externos.
@Configuration
@Profile("!test")
public class RestClientConfiguration {

    @Bean
    @Qualifier("embeddingClient")
    public RestClient embeddingClient(
            @Value("${application.openai.api-key}") String apiKey,
            @Value("${application.openai.url}") String url
    ){
        return RestClient.builder()
                .baseUrl(url + "embeddings")
                .defaultHeader("Authorization", String.format("Bearer %s", apiKey))
                .build();
    }

    @Bean
    @Qualifier("clipImageClient")
    public RestClient clipImageClient(
            @Value("${application.clip.url}") String url
    ) {
        return RestClient.builder()
                .baseUrl(url + "embed/image")
                .build();
    }

    @Bean
    @Qualifier("clipTextClient")
    public RestClient clipTextClient(
            @Value("${application.clip.url}") String url
    ) {
        return RestClient.builder()
                .baseUrl(url + "embed/text")
                .build();
    }

    @Bean
    @Qualifier("completionClient")
    public RestClient completionClient(
            @Value("${application.openai.api-key}") String apiKey,
            @Value("${application.openai.url}") String url
    ){
        return RestClient.builder()
                .baseUrl(url + "chat/completions")
                .defaultHeader("Authorization", String.format("Bearer %s", apiKey))
                .build();
    }

    @Bean
    public Pinecone pinecone(
            @Value("${application.pinecone.api-key}") String apiKey
    ){
        return new Pinecone.Builder(apiKey).build();
    }

    @Bean
    public Index lostObjectIndex(Pinecone pinecone){
        return pinecone.getIndexConnection("clip-poc");
    }
}
