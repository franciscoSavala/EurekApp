package com.eurekapp.backend.model;

import com.google.protobuf.Struct;
import com.google.protobuf.Value;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Data
@Builder
public class LostObjectStructVector implements StructVector {
    private String id;
    private List<Float> embeddings;
    private Float score;

    //metadata
    private String description;
    private String username;

    @Override
    public Struct toStruct() {
        return Struct.newBuilder()
                .putFields("description", Value.newBuilder().setStringValue(description).build())
                .putFields("username", Value.newBuilder().setStringValue(username).build())
                .build();
    }
}
