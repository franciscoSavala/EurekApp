package com.eurekapp.backend.model;

/**
 * Categorías DURAS y abarcativas del rework de búsqueda (EU-320/EU-322). Son fronteras
 * 0-ambiguas definidas por IA a partir de la imagen (no elegidas por el usuario): nunca se
 * compara ni se notifica entre categorías distintas.
 *
 * <p>{@link #OTROS} es el complemento: cae ahí lo que no encaja con confianza en ninguna
 * categoría concreta.</p>
 */
public enum ObjectCategory {
    ROPA,
    BILLETERA,
    LLAVES,
    CELULAR,
    OTROS;

    /**
     * Mapea la etiqueta cruda del clasificador a una categoría dura. Defensivo: cualquier valor
     * nulo o desconocido cae en {@link #OTROS}, de modo que un cambio de etiquetas en el micro
     * nunca rompe el backend.
     */
    public static ObjectCategory fromLabel(String label) {
        if (label == null) {
            return OTROS;
        }
        try {
            return ObjectCategory.valueOf(label.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return OTROS;
        }
    }
}
