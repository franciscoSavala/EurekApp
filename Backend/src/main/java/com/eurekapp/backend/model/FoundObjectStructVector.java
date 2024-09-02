package com.eurekapp.backend.model;


import com.google.protobuf.Descriptors;
import com.google.protobuf.Struct;
import com.google.protobuf.Value;
import io.pinecone.proto.Vector;
import io.pinecone.unsigned_indices_model.ScoredVectorWithUnsignedIndices;
import lombok.*;

import java.text.DateFormat;
import java.time.LocalDateTime;
import java.util.Date;
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
    private LocalDateTime foundDate;
    private Boolean wasReturned;

    @Override
    public Struct toStruct() {
        return Struct.newBuilder()
                .putFields("text", Value.newBuilder().setStringValue(text).build())
                .putFields("human_description", Value.newBuilder().setStringValue(humanDescription).build())
                .putFields("organization_id", Value.newBuilder().setStringValue(organization).build())
                .putFields("found_date", Value.newBuilder().setStringValue(foundDate.toString()).build())
                .putFields("was_returned", Value.newBuilder().setBoolValue(wasReturned).build())
                .build();
    }

    @Override
    public StructVector fromScoredVector(ScoredVectorWithUnsignedIndices scoredVector){
        Value defaultStringValue = Value.newBuilder().setStringValue("").build();
        Value defaultBoolValue = Value.newBuilder().setBoolValue(false).build();
        Value defaultTime = Value.newBuilder().setStringValue(LocalDateTime.now().toString()).build();
        String date = scoredVector.getMetadata().getFieldsOrDefault("found_date", defaultTime).getStringValue();
        Boolean wasReturned = scoredVector.getMetadata().getFieldsOrDefault("was_returned", defaultBoolValue).getBoolValue();
        return FoundObjectStructVector.builder()
                .id(scoredVector.getId())
                .score(scoredVector.getScore())
                .text(scoredVector.getMetadata().getFieldsOrThrow("text").getStringValue())
                .humanDescription(scoredVector.getMetadata().getFieldsOrDefault("human_description", defaultStringValue).getStringValue())
                .organization(scoredVector.getMetadata().getFieldsOrDefault("organization_id", defaultStringValue).getStringValue())
                .foundDate(LocalDateTime.parse(date))
                .wasReturned(wasReturned)
                .build();
    }

    public StructVector fromVector(Vector vector){
        Value defaultStringValue = Value.newBuilder().setStringValue("").build();
        Value defaultBoolValue = Value.newBuilder().setBoolValue(false).build();
        Value defaultTime = Value.newBuilder().setStringValue(LocalDateTime.now().toString()).build();
        String date = vector.getMetadata().getFieldsOrDefault("found_date", defaultTime).getStringValue();
        Boolean wasReturned = vector.getMetadata().getFieldsOrDefault("was_returned", defaultBoolValue).getBoolValue();
        return FoundObjectStructVector.builder()
                .id(vector.getId())
                .text(vector.getMetadata().getFieldsOrThrow("text").getStringValue())
                .humanDescription(vector.getMetadata().getFieldsOrDefault("human_description", defaultStringValue).getStringValue())
                .organization(vector.getMetadata().getFieldsOrDefault("organization_id", defaultStringValue).getStringValue())
                .foundDate(LocalDateTime.parse(date))
                .wasReturned(wasReturned)
                .build();
    }
}
