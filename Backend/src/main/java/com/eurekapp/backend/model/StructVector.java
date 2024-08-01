package com.eurekapp.backend.model;

import com.google.protobuf.Struct;
import io.pinecone.unsigned_indices_model.ScoredVectorWithUnsignedIndices;

import java.util.List;

public interface StructVector {
    Struct toStruct();
    List<Float> getEmbeddings();
    String getId();
    StructVector fromScoredVector(ScoredVectorWithUnsignedIndices scoredVectorWithUnsignedIndices);
    Float getScore();
}
