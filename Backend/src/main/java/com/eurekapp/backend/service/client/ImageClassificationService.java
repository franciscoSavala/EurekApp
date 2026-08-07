package com.eurekapp.backend.service.client;

import com.eurekapp.backend.model.ObjectCategory;

/**
 * Clasificación de una imagen en las categorías DURAS del rework (EU-322), usada como filtro
 * previo del matching (nunca se compara entre categorías distintas).
 *
 * <p>Está abstraída a propósito: la implementación actual ({@link ClipImageClassificationService})
 * usa CLIP zero-shot self-hosted (local, sin costo por token), pero puede reemplazarse por otra
 * (p. ej. OpenAI) sin tocar a los consumidores.</p>
 */
public interface ImageClassificationService {

    /**
     * @param imageBytes bytes de la imagen del objeto.
     * @return la categoría dura del objeto; {@link ObjectCategory#OTROS} si no encaja con
     *         confianza en ninguna categoría concreta.
     */
    ObjectCategory classify(byte[] imageBytes);
}
