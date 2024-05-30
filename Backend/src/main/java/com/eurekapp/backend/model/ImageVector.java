package com.eurekapp.backend.model;


import com.google.protobuf.Struct;
import com.google.protobuf.Value;
import io.pinecone.unsigned_indices_model.ScoredVectorWithUnsignedIndices;
import lombok.*;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ImageVector implements VectorPinecone{
    private String id;
    private List<Float> embeddings;
    private String text;
    private String humanDescription;
    private Float score;

    @Override
    public Struct toStruct() {
        return Struct.newBuilder()
                .putFields("text", Value.newBuilder().setStringValue(text).build())
                .putFields("human_description", Value.newBuilder().setStringValue(humanDescription).build())
                .build();
    }

    @Override
    public VectorPinecone fromScoredVector(ScoredVectorWithUnsignedIndices scoredVector){
        Value defaultValue = Value.newBuilder().setStringValue("").build();
        return ImageVector.builder()
                .id(scoredVector.getId())
                .score(scoredVector.getScore())
                .text(scoredVector.getMetadata().getFieldsOrThrow("text").getStringValue())
                .humanDescription(scoredVector.getMetadata().getFieldsOrDefault("human_description", defaultValue).getStringValue())
                .build();
    }
}
