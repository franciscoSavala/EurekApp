package com.eurekapp.backend.repository;

import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.FoundObjectStructVector;
import com.eurekapp.backend.model.StructVector;
import com.eurekapp.backend.model.StructVectorFactory;
import com.google.protobuf.Struct;
import io.pinecone.clients.Index;
import io.pinecone.proto.FetchResponse;
import io.pinecone.proto.UpsertResponse;
import io.pinecone.proto.Vector;
import io.pinecone.unsigned_indices_model.QueryResponseWithUnsignedIndices;
import lombok.SneakyThrows;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class TextPineconeRepository<T extends StructVector> implements VectorStorage<T>{
    private static final Logger log = LoggerFactory.getLogger(TextPineconeRepository.class);
    private final Index client;
    @Value("${application.pinecone.namespace}")
    private String namespace;
    private StructVectorFactory factory;


    public TextPineconeRepository(Index client,
                                  @Qualifier("foundObjectVectorFactory") StructVectorFactory factory) {
        this.client = client;
        this.factory = factory;
    }

    /* Upsert = Operación de BD que implica intentar hacer un "INSERT", y si el registro ya existe, entonces hacer un
        "UPDATE" en su lugar.
        Este método recibe un vector y hace un upsert en la BD de Pinecone, mediante la API de Pinecone.
        En nuestra aplicación, el vector en cuestión representa un objeto perdido/encontrado. */
    public void upsertVector(T vector){
        Struct struct = vector.toStruct();
        UpsertResponse upsertResponse = client.upsert(vector.getId(), vector.getEmbeddings(), null, null, struct, namespace);
        log.info("[api_method:GET] [api_call:pinecone] Request={} Response={}", struct, upsertResponse);
    }

    public T fetchVector(String id){
        List<String> idList = Collections.singletonList(id);
        FetchResponse fetchResponse = client.fetch(idList, namespace);
        Map<String, Vector> vectors = fetchResponse.getVectorsMap();
        if(vectors.isEmpty())
            throw new NotFoundException("found_object_not_found",
                    String.format("The object with uuid '%s' was not found", id));

        log.info("[api_method:GET] [api_call:pinecone] Response={}", fetchResponse);

        return (T) factory.fromVector(vectors.get(id));
    }

    public List<T> queryVector(T vector) {
        return queryVector(vector, 3, null);
    }

    public List<T> queryVector(T vector, Integer topK, Struct filter){
        QueryResponseWithUnsignedIndices queryResponse = client.queryByVector(
                topK,
                vector.getEmbeddings(),
                namespace,
                filter, //if filter is null, pinecone ignores it
                false,
                true);

        log.info("[api_method:GET] [api_call:pinecone] Response={}", queryResponse);

        return queryResponse.getMatchesList().stream()
                .map(scoredVector -> (T) factory.fromScoredVector(scoredVector))
                .sorted(Comparator.comparing(StructVector::getScore).reversed())
                .toList();
    }


}
