package com.eurekapp.backend.util;

import java.text.Normalizer;
import java.util.regex.Pattern;

/***
 *      Normalización de texto para la coincidencia textual (EU-142).
 *
 *      Se aplica por igual a los DOS lados de la comparación: al texto que se persiste (título y
 *      descripción de un objeto encontrado / descripción de una búsqueda) y al texto de la query.
 *      Si se aplicara a un solo lado, la normalización rompería las coincidencias en vez de mejorarlas.
 *
 *      Es una limpieza CIEGA: no sabe si una secuencia de dígitos es un DNI, un IMEI o una patente,
 *      y no debe saberlo. Cualquier regex por tipo de dato dejaría afuera los formatos no previstos.
 * ***/
public class TextNormalizer {

    /* Un separador (punto, guion, barra o espacio) ENTRE dos dígitos: "45.789.654" -> "45789654".
       Sólo entre dígitos, para no pegar palabras que nada tienen que ver ("mochila-roja" queda igual). */
    private static final Pattern SEPARATOR_BETWEEN_DIGITS = Pattern.compile("(\\d)[.\\-/\\s]+(?=\\d)");

    private static final Pattern COMBINING_MARKS = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");

    private static final Pattern WHITESPACE_RUN = Pattern.compile("\\s+");

    /* Marcador temporal para sacar la "ñ" del camino mientras se quitan las tildes: es una letra
       distinta, no una "n" acentuada, y descomponerla la convertiría en "n" ("año" -> "ano"). */
    private static final String N_TILDE_PLACEHOLDER = String.valueOf((char) 1);

    // Constructor privado para prevenir instanciación.
    private TextNormalizer() {
        throw new UnsupportedOperationException("Utility class cannot be instantiated");
    }

    public static String normalize(String text) {
        if (text == null) {
            return null;
        }

        String normalized = text.toLowerCase();
        normalized = stripAccents(normalized);
        normalized = joinNumericSequences(normalized);
        normalized = WHITESPACE_RUN.matcher(normalized).replaceAll(" ").trim();

        return normalized;
    }

    /***
     *      Quita las tildes dejando la letra base ("bermejá" -> "bermeja"), para que una misma palabra
     *      escrita con y sin tilde sea el mismo término a los ojos del buscador por palabras.
     * ***/
    private static String stripAccents(String text) {
        String withPlaceholder = text.replace("ñ", N_TILDE_PLACEHOLDER);
        String decomposed = Normalizer.normalize(withPlaceholder, Normalizer.Form.NFD);
        String stripped = COMBINING_MARKS.matcher(decomposed).replaceAll("");
        return stripped.replace(N_TILDE_PLACEHOLDER, "ñ");
    }

    /***
     *      Pega los grupos de dígitos que estén separados por puntos, guiones, barras o espacios, para que
     *      un mismo identificador escrito con distinto formato quede idéntico en ambos lados de la
     *      comparación ("45.789.654", "45-789-654" y "45789654" colapsan todos a "45789654").
     * ***/
    private static String joinNumericSequences(String text) {
        return SEPARATOR_BETWEEN_DIGITS.matcher(text).replaceAll("$1");
    }
}
