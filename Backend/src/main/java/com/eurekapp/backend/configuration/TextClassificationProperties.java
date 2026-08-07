package com.eurekapp.backend.configuration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Parámetro calibrable del clasificador de categoría por TEXTO (EU-337 punto 3), externalizado
 * (prefijo {@code search.text-classification}) para ajustarlo sin recompilar.
 */
@ConfigurationProperties(prefix = "search.text-classification")
public class TextClassificationProperties {

    /**
     * Piso ABSOLUTO de coseno contra la mejor frase de categoría. Por debajo el clasificador se
     * ABSTIENE (devuelve null) y decide la foto. El porqué del número y por qué el corte no va
     * sobre la confianza está en {@code EmbeddingTextClassificationService}.
     */
    private double minSimilarity = 0.48;

    public double getMinSimilarity() {
        return minSimilarity;
    }

    public void setMinSimilarity(double minSimilarity) {
        this.minSimilarity = minSimilarity;
    }
}
