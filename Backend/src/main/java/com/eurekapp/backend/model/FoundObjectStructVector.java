package com.eurekapp.backend.model;


import com.google.protobuf.Struct;
import com.google.protobuf.Value;
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
    private String aiDescription;
    private String title;
    private String organization;
    private LocalDateTime foundDate;
    private Boolean wasReturned;
    private String detailedDescription;
    private Double latitude;
    private Double longitude;

    @Override
    public Struct toStruct() {
        return Struct.newBuilder()
                .putFields("text", Value.newBuilder().setStringValue(aiDescription).build())
                .putFields("title", Value.newBuilder().setStringValue(title).build())
                .putFields("organization_id", Value.newBuilder().setStringValue(organization).build())
                .putFields("found_date", Value.newBuilder().setStringValue(foundDate.toString()).build())
                .putFields("was_returned", Value.newBuilder().setBoolValue(wasReturned).build())
                .putFields("human_description", Value.newBuilder().setStringValue(detailedDescription).build())
                .putFields("latitude", Value.newBuilder().setNumberValue(latitude).build())
                .putFields("longitude", Value.newBuilder().setNumberValue(longitude).build())
                .build();
    }
}
