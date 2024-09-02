package com.eurekapp.backend.model;


import com.google.protobuf.Struct;
import com.google.protobuf.Value;
import io.pinecone.proto.Vector;
import io.pinecone.unsigned_indices_model.ScoredVectorWithUnsignedIndices;
import lombok.*;

import java.time.LocalDateTime;
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
}
