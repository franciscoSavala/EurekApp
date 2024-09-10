package com.eurekapp.backend.model;

import com.google.protobuf.Struct;
import com.google.protobuf.Value;
import io.pinecone.proto.Vector;
import io.pinecone.unsigned_indices_model.ScoredVectorWithUnsignedIndices;
import org.springframework.stereotype.Component;
import java.time.LocalDateTime;
import java.util.List;

@Component
public class FoundObjectVectorFactory implements StructVectorFactory {

    @org.springframework.beans.factory.annotation.Value("found-object")
    private String namespace;

    @Override
    public StructVector fromScoredVector(ScoredVectorWithUnsignedIndices vector){
        return fromMetadata(vector.getMetadata(), vector.getId(), vector.getScore(), vector.getValuesList());
    }

    @Override
    public StructVector fromVector(Vector vector){
        return fromMetadata(vector.getMetadata(), vector.getId(), null, vector.getValuesList());
    }


    private StructVector fromMetadata(Struct metadata, String id, Float score, List<Float> values) {
        Value defaultStringValue = Value.newBuilder().setStringValue("").build();
        Value defaultBoolValue = Value.newBuilder().setBoolValue(false).build();
        Value defaultTime = Value.newBuilder().setStringValue(LocalDateTime.now().toString()).build();
        String date = metadata.getFieldsOrDefault("found_date", defaultTime).getStringValue();
        Boolean wasReturned = metadata.getFieldsOrDefault("was_returned", defaultBoolValue).getBoolValue();
        return FoundObjectStructVector.builder()
                .embeddings(values)
                .id(id)
                .score(score)
                .aiDescription(metadata.getFieldsOrThrow("text").getStringValue())
                .title(metadata.getFieldsOrDefault("title", defaultStringValue).getStringValue())
                .detailedDescription(metadata.getFieldsOrDefault("human_description", defaultStringValue).getStringValue())
                .organization(metadata.getFieldsOrDefault("organization_id", defaultStringValue).getStringValue())
                .foundDate(LocalDateTime.parse(date))
                .wasReturned(wasReturned)
                .build();
    }

    public String getNamespace() {
        return namespace;
    }
}
