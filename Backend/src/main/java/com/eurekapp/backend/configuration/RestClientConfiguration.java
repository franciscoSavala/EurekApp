package com.eurekapp.backend.configuration;

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
    @Qualifier("clipClient")
    public RestClient clipClient(
            @Value("${application.clip.url}") String url
    ){
        // Microservicio CLIP self-hosted (clip-service, EU-321). Sin auth: corre en la red interna.
        // Forzamos HTTP/1.1: el HttpClient del JDK intenta por defecto un upgrade a HTTP/2 en claro (h2c)
        // agregando los headers Connection: Upgrade / Upgrade: h2c. El micro (uvicorn/FastAPI) no soporta
        // ese upgrade y, ante un POST multipart con esos headers, no reconoce el campo "file" (responde 422
        // "field required"). Con HTTP/1.1 puro —igual que curl— el multipart se procesa bien.
        java.net.http.HttpClient httpClient = java.net.http.HttpClient.newBuilder()
                .version(java.net.http.HttpClient.Version.HTTP_1_1)
                .build();
        return RestClient.builder()
                .baseUrl(url)
                .requestFactory(new org.springframework.http.client.JdkClientHttpRequestFactory(httpClient))
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

}
