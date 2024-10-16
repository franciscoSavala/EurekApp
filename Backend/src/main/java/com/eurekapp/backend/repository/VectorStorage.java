package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.StructVector;
import com.google.protobuf.Struct;
import io.pinecone.proto.Vector;

import java.util.List;

public interface VectorStorage<T extends StructVector> {
    void upsertVector(T vector);
    List<T> queryVector(T vector);
    List<T> queryVector(T vector, Integer topK, Struct filter);
    T fetchVector(String id);
}
