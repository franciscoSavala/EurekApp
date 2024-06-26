package com.eurekapp.backend.model;

import com.google.protobuf.Struct;
import com.google.protobuf.Value;
import io.pinecone.unsigned_indices_model.ScoredVectorWithUnsignedIndices;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Data
@Builder
public class TextVector implements VectorPinecone{
    private String id;
    private List<Float> embeddings;
    private String text;
    private Float score;

    @Override
    public Struct toStruct() {
        return Struct.newBuilder()
                .putFields("text", Value.newBuilder().setStringValue(text).build())
                .build();
    }

    @Override
    public VectorPinecone fromScoredVector(ScoredVectorWithUnsignedIndices scoredVector){
        return TextVector.builder()
                .id(scoredVector.getId())
                .score(scoredVector.getScore())
                .text(scoredVector.getMetadata().getFieldsOrThrow("text").getStringValue())
                .build();
    }
}
