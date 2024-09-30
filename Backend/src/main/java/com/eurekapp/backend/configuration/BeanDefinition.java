package com.eurekapp.backend.configuration;

import com.eurekapp.backend.model.FoundObjectStructVector;
import com.eurekapp.backend.model.LostObjectStructVector;
import com.eurekapp.backend.model.StructVectorFactory;
import com.eurekapp.backend.repository.PineconeVectorStorage;
import com.eurekapp.backend.repository.VectorStorage;
import io.pinecone.clients.Index;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Configuration
public class BeanDefinition {

    @Bean
    public VectorStorage<FoundObjectStructVector> foundObjectVectorStorage(
            Index index,
            @Qualifier("foundObjectVectorFactory") StructVectorFactory structVectorFactory
    ) {
        return new PineconeVectorStorage<>(index, structVectorFactory);
    }

    @Bean
    public VectorStorage<LostObjectStructVector> lostObjectVectorStorage(
            Index index,
            @Qualifier("lostObjectVectorFactory") StructVectorFactory structVectorFactory) {
        return new PineconeVectorStorage<>(index, structVectorFactory);
    }

    @Bean
    public ExecutorService executorService() {
        return Executors.newVirtualThreadPerTaskExecutor();
    }
}
