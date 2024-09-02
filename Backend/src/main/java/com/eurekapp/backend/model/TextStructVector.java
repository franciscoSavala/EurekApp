package com.eurekapp.backend.model;

import com.google.protobuf.Struct;
import com.google.protobuf.Value;
import io.pinecone.proto.Vector;
import io.pinecone.unsigned_indices_model.ScoredVectorWithUnsignedIndices;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Data
@Builder
public class TextStructVector implements StructVector {
    private String id;
    private List<Float> embeddings;
    private String text;
    private Float score;

    @Override
    public Struct toStruct() {
        return Struct.newBuilder()
                .putFields("text", Value.newBuilder().setStringValue(text).build())
                .build();
    }

    @Override
    public StructVector fromScoredVector(ScoredVectorWithUnsignedIndices scoredVector){
        return TextStructVector.builder()
                .id(scoredVector.getId())
                .score(scoredVector.getScore())
                .text(scoredVector.getMetadata().getFieldsOrThrow("text").getStringValue())
                .build();
    }

    /* Esto está mal pero tiene que estar para que funcione. Vamos a poder arreglarlo al aplicar Factory Method
        a la interfaz StructVector */
    @Override
    public StructVector fromVector(Vector vector){ return new TextStructVector(); }
}
