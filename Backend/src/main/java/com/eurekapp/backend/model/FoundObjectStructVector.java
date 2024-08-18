package com.eurekapp.backend.model;


import com.google.protobuf.Descriptors;
import com.google.protobuf.Struct;
import com.google.protobuf.Value;
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

    @Override
    public Struct toStruct() {
        return Struct.newBuilder()
                .putFields("text", Value.newBuilder().setStringValue(text).build())
                .putFields("human_description", Value.newBuilder().setStringValue(humanDescription).build())
                .putFields("organization_id", Value.newBuilder().setStringValue(organization).build())
                .putFields("found_date", Value.newBuilder().setStringValue(foundDate.toString()).build())
                .build();
    }

    @Override
    public StructVector fromScoredVector(ScoredVectorWithUnsignedIndices scoredVector){
        Value defaultValue = Value.newBuilder().setStringValue("").build();
        Value defaultTime = Value.newBuilder().setStringValue(LocalDateTime.now().toString()).build();
        String date = scoredVector.getMetadata().getFieldsOrDefault("found_date", defaultTime).getStringValue();
        return FoundObjectStructVector.builder()
                .id(scoredVector.getId())
                .score(scoredVector.getScore())
                .text(scoredVector.getMetadata().getFieldsOrThrow("text").getStringValue())
                .humanDescription(scoredVector.getMetadata().getFieldsOrDefault("human_description", defaultValue).getStringValue())
                .organization(scoredVector.getMetadata().getFieldsOrDefault("organization_id", defaultValue).getStringValue())
                .foundDate(LocalDateTime.parse(date))
                .build();
    }
}
