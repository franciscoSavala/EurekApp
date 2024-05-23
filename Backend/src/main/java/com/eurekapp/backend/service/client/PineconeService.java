package com.eurekapp.backend.service.client;

import com.eurekapp.backend.model.TextVector;
import com.eurekapp.backend.model.TextVectorScore;
import com.google.protobuf.Struct;
import com.google.protobuf.Value;
import io.pinecone.clients.Index;
import io.pinecone.proto.QueryResponse;
import io.pinecone.proto.UpsertResponse;
import io.pinecone.proto.Vector;
import io.pinecone.unsigned_indices_model.QueryResponseWithUnsignedIndices;
import io.pinecone.unsigned_indices_model.ScoredVectorWithUnsignedIndices;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;

@Service
public class PineconeService {
    private static final Logger log = LoggerFactory.getLogger(PineconeService.class);
    private final Index client;
    @org.springframework.beans.factory.annotation.Value("${application.pinecone.namespace}")
    private String namespace;
    public PineconeService(Index client) {
        this.client = client;
    }

    public void upsertVector(TextVector textVector){
        Struct struct = Struct.newBuilder()
                .putFields("text", Value.newBuilder().setStringValue(textVector.getText()).build())
                .build();
        UpsertResponse upsertResponse = client.upsert(textVector.getId(), textVector.getEmbeddings(), null, null, struct, namespace);
        log.info("[api_method:GET] [api_call:pinecone] Request={} Response={}", struct, upsertResponse);
    }

    public List<TextVectorScore> queryVector(TextVector textVector) {
        return queryVector(textVector, 10);
    }

    public List<TextVectorScore> queryVector(TextVector textVector, Integer topK){
        QueryResponseWithUnsignedIndices queryResponse = client.queryByVector(
                topK,
                textVector.getEmbeddings(),
                namespace,
                false,
                true);

        return queryResponse.getMatchesList().stream()
                .map(this::scoredVectorToTextVectorScore)
                .sorted(Comparator.comparing(TextVectorScore::getScore).reversed())
                .toList();
    }

    private TextVectorScore scoredVectorToTextVectorScore(ScoredVectorWithUnsignedIndices scoredVector){
        return TextVectorScore.builder()
                .id(scoredVector.getId())
                .score(scoredVector.getScore())
                .text(scoredVector.getMetadata().getFieldsOrThrow("text").getStringValue())
                .build();
    }
}
