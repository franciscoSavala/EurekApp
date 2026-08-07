package com.eurekapp.backend.service.client;

import java.util.List;

/**
 * Vectorización de imágenes para la búsqueda reversa (EU-321): una foto se convierte
 * directamente en un embedding visual (sin pasar por una descripción textual), para poder
 * comparar objetos por similitud coseno de imagen.
 *
 * <p>Es el análogo visual de {@link EmbeddingService} (que vectoriza texto). La implementación
 * actual delega en un microservicio CLIP self-hosted.</p>
 */
public interface ImageEmbeddingService {

    /**
     * @param imageBytes bytes de la imagen (JPEG/PNG/...).
     * @return embedding visual como vector unitario; el producto punto entre dos de estos
     *         vectores es directamente la similitud coseno.
     */
    List<Float> getImageVectorRepresentation(byte[] imageBytes);
}
