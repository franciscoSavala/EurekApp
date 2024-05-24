package com.eurekapp.backend.model;

import com.google.protobuf.Struct;
import io.pinecone.unsigned_indices_model.ScoredVectorWithUnsignedIndices;

import java.util.List;

public interface VectorPinecone {
    Struct toStruct();
    List<Float> getEmbeddings();
    String getId();
    VectorPinecone fromScoredVector(ScoredVectorWithUnsignedIndices scoredVectorWithUnsignedIndices);
    Float getScore();
}
