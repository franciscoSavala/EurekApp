package com.eurekapp.backend.model;

import com.google.protobuf.Struct;
import io.pinecone.proto.Vector;
import io.pinecone.unsigned_indices_model.ScoredVectorWithUnsignedIndices;

public interface StructVectorFactory {
    StructVector fromScoredVector(ScoredVectorWithUnsignedIndices scoredVectorWithUnsignedIndices);
    StructVector fromVector(Vector vector);
}
