package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.StructVector;
import com.google.protobuf.Struct;
import io.pinecone.clients.Index;
import io.pinecone.proto.UpsertResponse;
import io.pinecone.unsigned_indices_model.QueryResponseWithUnsignedIndices;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;

@Service
public class TextPineconeRepository<T extends StructVector> implements VectorStorage<T>{
    private static final Logger log = LoggerFactory.getLogger(TextPineconeRepository.class);
    private final Index client;
    @Value("${application.pinecone.namespace}")
    private String namespace;
    public TextPineconeRepository(Index client) {
        this.client = client;
    }

    public void upsertVector(T vector){
        Struct struct = vector.toStruct();
        UpsertResponse upsertResponse = client.upsert(vector.getId(), vector.getEmbeddings(), null, null, struct, namespace);
        log.info("[api_method:GET] [api_call:pinecone] Request={} Response={}", struct, upsertResponse);
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
                .map(scoredVector -> (T) vector.fromScoredVector(scoredVector))
                .sorted(Comparator.comparing(StructVector::getScore).reversed())
                .toList();
    }


}
