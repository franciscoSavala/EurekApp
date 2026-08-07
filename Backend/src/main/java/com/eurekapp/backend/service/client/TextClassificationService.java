package com.eurekapp.backend.service.client;

import com.eurekapp.backend.model.ObjectCategory;

/**
 * Clasificación de un objeto en una {@link ObjectCategory} a partir de su DESCRIPCIÓN (EU-337).
 *
 * <p>Es la contracara de {@link ImageClassificationService}: la foto nunca viene vacía pero es
 * ruidosa; el texto es casi infalible cuando NOMBRA el objeto y no dice nada cuando no lo nombra.
 * Por eso este contrato admite explícitamente la ABSTENCIÓN.</p>
 */
public interface TextClassificationService {

    /**
     * @return la categoría que el texto nombra, o {@code null} si el texto no alcanza para decidir
     *         (abstención). Nunca devuelve OTROS como comodín de la duda: OTROS es una categoría
     *         dura más y mandar la duda ahí la hace competir contra paraguas y mochilas.
     */
    ObjectCategory classify(String text);
}
