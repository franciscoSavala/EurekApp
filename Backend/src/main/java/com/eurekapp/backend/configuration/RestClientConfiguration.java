package com.eurekapp.backend.configuration;

import io.pinecone.clients.Index;
import io.pinecone.clients.Pinecone;
import io.weaviate.client.Config;
import io.weaviate.client.WeaviateClient;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.web.client.RestClient;
import java.util.HashMap;
import java.util.Map;


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
    @Qualifier("weaviateClient")
    public WeaviateClient weaviateClient(
            @Value("${application.weaviate.schema}") String schema,
            @Value("${application.weaviate.url}") String baseUrl
    ){
        Map<String, String> headers = new HashMap<String, String>() { {
            put("Content-Type", "application/json");
        } };
        Config config = new Config("http", baseUrl, headers);
        WeaviateClient client = new WeaviateClient(config);
        return client;
    }

    @Bean
    public Pinecone pinecone(
            @Value("${application.pinecone.api-key}") String apiKey
    ){
        return new Pinecone.Builder(apiKey).build();
    }


    @Bean
    public Index lostObjectIndex(Pinecone pinecone){
        return pinecone.getIndexConnection("eurekapp");
    }




}
