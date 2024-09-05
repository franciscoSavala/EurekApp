package com.eurekapp.backend.model;

import com.google.protobuf.Struct;
import com.google.protobuf.Value;
import io.pinecone.proto.Vector;
import io.pinecone.unsigned_indices_model.ScoredVectorWithUnsignedIndices;
import org.springframework.stereotype.Component;
import java.util.List;

@Component
public class LostObjectVectorFactory implements StructVectorFactory {

    @org.springframework.beans.factory.annotation.Value("lost-object")
    private String namespace;

    @Override
    public StructVector fromScoredVector(ScoredVectorWithUnsignedIndices vector) {
        return fromMetadata(vector.getMetadata(), vector.getId(), vector.getScore(), vector.getValuesList());
    }

    @Override
    public StructVector fromVector(Vector vector) {
        return fromMetadata(vector.getMetadata(), vector.getId(), null, vector.getValuesList());
    }

    private StructVector fromMetadata(Struct metadata, String id, Float score, List<Float> values) {
        Value defaultStringValue = Value.newBuilder().setStringValue("").build();
        return LostObjectStructVector.builder()
                .id(id)
                .embeddings(values)
                .score(score)
                .description(metadata.getFieldsOrDefault("description", defaultStringValue).getStringValue())
                .build();
    }

    @Override
    public String getNamespace() {
        return namespace;
    }
}
