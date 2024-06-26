package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.VectorPinecone;
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
public class TextPineconeRepository<T extends VectorPinecone> {
    private static final Logger log = LoggerFactory.getLogger(TextPineconeRepository.class);
    private final Index client;
    @Value("${application.pinecone.namespace}")
    private String namespace;
    public TextPineconeRepository(Index client) {
        this.client = client;
    }

    public void upsertVector(T pineconeVector){
        Struct struct = pineconeVector.toStruct();
        UpsertResponse upsertResponse = client.upsert(pineconeVector.getId(), pineconeVector.getEmbeddings(), null, null, struct, namespace);
        log.info("[api_method:GET] [api_call:pinecone] Request={} Response={}", struct, upsertResponse);
    }

    public List<T> queryVector(T pineconeVector) {
        return queryVector(pineconeVector, 3, null);
    }

    public List<T> queryVector(T pineconeVector, Integer topK, Struct filter){
        QueryResponseWithUnsignedIndices queryResponse = client.queryByVector(
                topK,
                pineconeVector.getEmbeddings(),
                namespace,
                filter, //if filter is null, pinecone ignores it
                false,
                true);

        log.info("[api_method:GET] [api_call:pinecone] Response={}", queryResponse);

        return queryResponse.getMatchesList().stream()
                .map(scoredVector -> (T) pineconeVector.fromScoredVector(scoredVector))
                .sorted(Comparator.comparing(VectorPinecone::getScore).reversed())
                .toList();
    }


}
