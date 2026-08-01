package com.eurekapp.backend.model;

/**
 * Categorías DURAS y abarcativas del rework de búsqueda (EU-320/EU-322). Son fronteras
 * 0-ambiguas definidas por IA a partir de la imagen (no elegidas por el usuario): nunca se
 * compara ni se notifica entre categorías distintas.
 *
 * <p>{@link #OTROS} es el complemento: cae ahí lo que no encaja con confianza en ninguna
 * categoría concreta. Ojo: el clasificador también tiene descripciones PROPIAS de OTROS
 * (paraguas, mochila, botella…), así que OTROS se elige de verdad y no es sólo un fallback.</p>
 *
 * <p><b>Por qué son pocas y anchas:</b> el filtro es duro, así que si los dos lados de una
 * comparación caen en categorías distintas el par se vuelve invisible —fallo silencioso e
 * irrecuperable—. Medido sobre las fotos del seed (2026-08-01): con un esquema fino de 12
 * categorías, 2 de 5 pares se partieron y hasta una foto limpia de celular dejó de reconocerse,
 * porque cada categoría compite contra sus VECINAS y el margen de confianza se evapora
 * (teléfono/computadora/cargador se pisan entre sí). Con estas 5 los márgenes van de 0.034 a
 * 0.086 y los 5 pares caen del mismo lado. Regla para agregar una sexta: sólo si es
 * inconfundible respecto de TODAS las existentes (paraguas y anteojos calificarían; separar
 * computadora de teléfono no).</p>
 */
public enum ObjectCategory {
    ROPA,
    BILLETERA,
    LLAVES,
    /**
     * Todo lo que tiene batería o se enchufa: celular, notebook, tablet, auriculares, cargador.
     * Antes era CELULAR (sólo teléfonos): esa frontera obligaba a decidir cuán parecida a un
     * celular es una notebook, y ahí se equivocaba (una foto del par de la notebook del seed caía
     * en CELULAR y la otra en OTROS, partiendo el par). "¿Tiene batería o se enchufa?" se responde
     * solo.
     */
    ELECTRONICA,
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
