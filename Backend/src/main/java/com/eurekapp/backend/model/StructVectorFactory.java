package com.eurekapp.backend.model;

import io.pinecone.proto.Vector;
import io.pinecone.unsigned_indices_model.ScoredVectorWithUnsignedIndices;

public interface StructVectorFactory {
    StructVector fromScoredVector(ScoredVectorWithUnsignedIndices vector);
    StructVector fromVector(Vector vector);
    String getNamespace();
}
