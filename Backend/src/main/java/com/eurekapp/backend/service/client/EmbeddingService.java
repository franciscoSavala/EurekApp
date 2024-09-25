package com.eurekapp.backend.service.client;

import java.util.List;

public interface EmbeddingService {
    List<Float> getTextVectorRepresentation(String text);
    List<Float> getImageVectoRepresentation(byte[] image);
}
