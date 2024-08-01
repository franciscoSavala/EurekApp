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
public class FoundObjectStructVector implements StructVector {
    private String id;
    private List<Float> embeddings;
    private Float score;

    //metadata
    private String text;
    private String humanDescription;
    private String organization;

    @Override
    public Struct toStruct() {
        return Struct.newBuilder()
                .putFields("text", Value.newBuilder().setStringValue(text).build())
                .putFields("human_description", Value.newBuilder().setStringValue(humanDescription).build())
                .putFields("organization_id", Value.newBuilder().setStringValue(organization).build())
                .build();
    }

    @Override
    public StructVector fromScoredVector(ScoredVectorWithUnsignedIndices scoredVector){
        Value defaultValue = Value.newBuilder().setStringValue("").build();
        return FoundObjectStructVector.builder()
                .id(scoredVector.getId())
                .score(scoredVector.getScore())
                .text(scoredVector.getMetadata().getFieldsOrThrow("text").getStringValue())
                .humanDescription(scoredVector.getMetadata().getFieldsOrDefault("human_description", defaultValue).getStringValue())
                .organization(scoredVector.getMetadata().getFieldsOrDefault("organization_id", defaultValue).getStringValue())
                .build();
    }
}
