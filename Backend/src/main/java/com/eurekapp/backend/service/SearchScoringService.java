package com.eurekapp.backend.service;

import com.eurekapp.backend.configuration.ScoringProperties;
import com.eurekapp.backend.model.GeoCoordinates;
import com.eurekapp.backend.model.ObjectCategory;
import org.springframework.stereotype.Service;

/**
 * Fuente de verdad ÚNICA del algoritmo de puntaje de coincidencias (ranking) de EurekApp.
 *
 * <p>Centraliza la fórmula con la que se decide cuán parecida es una publicación a una búsqueda,
 * el umbral de corte y la normalización de la certeza coseno. <b>No</b> consulta Weaviate ni conoce
 * entidades: opera sobre primitivos (certezas coseno + dos pares de coordenadas), por lo que sirve
 * igual para los dos sentidos de búsqueda gracias a que la certeza coseno es simétrica.</p>
 *
 * <p>Conviven dos fórmulas durante la migración del rework (EU-320):</p>
 * <ul>
 *   <li><b>Legacy</b> — {@link #totalScore} (MOORA 95/5 texto/geografía), una sola certeza coseno.</li>
 *   <li><b>EU-324</b> — {@link #combinedScore}: {@code geoModulator · (α·sim_img + β·sim_txt)} con
 *       α/β por categoría. Es la que usa la búsqueda por foto y el match inverso una vez cableado el
 *       vector de imagen (CLIP). El legacy se retira cuando todos los callers migren.</li>
 * </ul>
 *
 * <p><b>Blast radius</b> — si en el futuro se modifica la fórmula, los pesos o el umbral, alcanza
 * con tocar esta clase. Consumidores actuales del algoritmo:</p>
 * <ul>
 *   <li>{@link FoundObjectService} — búsqueda normal (LostObject → FoundObjects) y búsqueda por foto.</li>
 *   <li>{@link LostObjectService} — búsqueda inversa (FoundObject → LostObjects), EU-279.</li>
 * </ul>
 */
@Service
public class SearchScoringService {

    /** Puntaje mínimo total para considerar que dos publicaciones coinciden. */
    public static final double MIN_SCORE = 0.75;

    /** Peso del parecido textual/visual (coseno) en el puntaje total (MOORA). */
    private static final double TEXT_WEIGHT = 0.95;

    /** Peso de la cercanía geográfica en el puntaje total (MOORA). */
    private static final double GEO_WEIGHT = 0.05;

    /** Parámetros calibrables (α/β por categoría, piso geográfico), externalizados a configuración. */
    private final ScoringProperties properties;

    public SearchScoringService(ScoringProperties properties) {
        this.properties = properties;
    }

    /**
     * Normaliza la certeza coseno cruda de Weaviate al rango [0, 1] usado por el ranking: todo lo
     * que está en o por debajo de 0.5 se descarta (queda en 0), y el resto se reescala linealmente.
     *
     * @param cosineCertainty certeza coseno cruda (puede ser null si la búsqueda no llevó vector).
     * @return parecido textual/visual normalizado en [0, 1].
     */
    public double normalizeCosineScore(Float cosineCertainty) {
        if (cosineCertainty == null) {
            return 0.0;
        }
        double certainty = cosineCertainty.doubleValue();
        return (certainty <= 0.5) ? 0.0 : (certainty - 0.5) * 2;
    }

    /**
     * Puntaje total de una coincidencia: combina el parecido textual/visual (coseno normalizado)
     * con la cercanía geográfica vía MOORA. Si no hay certeza coseno (búsqueda sin vector), el
     * puntaje es puramente geográfico, igual que en la búsqueda regular.
     *
     * @param cosineCertainty certeza coseno cruda de la publicación candidata (puede ser null).
     * @param a coordenadas de uno de los puntos (objeto candidato).
     * @param b coordenadas del otro punto (objeto/consulta de referencia).
     * @return puntaje total en [0, 1].
     */
    public double totalScore(Float cosineCertainty, GeoCoordinates a, GeoCoordinates b) {
        double geoScore = CommonFunctions.calculateGeoScore(a, b);
        if (cosineCertainty == null) {
            return geoScore;
        }
        return TEXT_WEIGHT * normalizeCosineScore(cosineCertainty) + GEO_WEIGHT * geoScore;
    }

    /** {@code true} si el puntaje total alcanza el umbral de coincidencia. */
    public boolean isMatch(double totalScore) {
        return totalScore >= MIN_SCORE;
    }

    // ── EU-324: puntaje combinado imagen + texto por categoría ──────────────────────────────────

    /**
     * Fallback 50/50 para una categoría ausente en la configuración (o nula). Las ponderaciones
     * α/β reales por categoría, y el piso geográfico, viven en {@link ScoringProperties} —externas
     * a propósito, para calibrarlas (EU-327) sin recompilar.
     */
    private static final ScoringProperties.Weight DEFAULT_WEIGHT = new ScoringProperties.Weight(0.50, 0.50);

    /**
     * Remapea el geoScore crudo ({@code e^{-k·d} ∈ (0, 1]}) al rango {@code [geoFloor, 1]} con el
     * que MODULA (multiplica) la suma de similitudes: mismo lugar → 1; lejos (pero dentro del radio,
     * que es un filtro duro aparte) → geoFloor. La geografía nunca anula un match, sólo lo atenúa.
     *
     * @return factor de modulación en {@code [geoFloor, 1]}. Si falta alguna coordenada devuelve 1.0,
     *         pero es sólo una red de seguridad: la ubicación es OBLIGATORIA en la búsqueda (sin ella
     *         no se puede circunscribir el radio) y esa exigencia se valida aguas arriba.
     */
    public double geoModulator(GeoCoordinates a, GeoCoordinates b) {
        if (a == null || b == null) {
            return 1.0; // red de seguridad: no debería ocurrir (la ubicación es obligatoria)
        }
        double geoScore = CommonFunctions.calculateGeoScore(a, b); // (0, 1]
        double geoFloor = properties.getGeoFloor();
        return geoFloor + (1.0 - geoFloor) * geoScore;
    }

    /**
     * Puntaje combinado del rework (EU-324): {@code geoModulator(a,b) · (α·sim_img + β·sim_txt)},
     * con α/β por categoría. Cada similitud se normaliza con {@link #normalizeCosineScore}.
     *
     * <p>Si falta una de las dos certezas (p. ej. una búsqueda sin foto, o sin texto), su peso se
     * <b>redistribuye</b> a la modalidad presente (renormalización), para que un match de una sola
     * modalidad no quede injustamente reducido por el peso de la ausente. Si faltan ambas, el
     * puntaje es 0 (no hay ninguna evidencia de parecido).</p>
     *
     * @param imageCertainty certeza coseno del vector de imagen (CLIP); null si la búsqueda no llevó foto.
     * @param textCertainty  certeza coseno del vector de texto (OpenAI); null si no llevó texto.
     * @param category       categoría dura del objeto (define α/β); null → 50/50.
     * @param a coordenadas de un punto (candidato).
     * @param b coordenadas del otro punto (consulta/objeto de referencia).
     * @return puntaje total en {@code [0, 1]}.
     */
    public double combinedScore(Float imageCertainty, Float textCertainty, ObjectCategory category,
                                GeoCoordinates a, GeoCoordinates b) {
        ScoringProperties.Weight weights = properties.getWeights().getOrDefault(
                category != null ? category : ObjectCategory.OTROS, DEFAULT_WEIGHT);

        // Peso efectivo de cada modalidad: 0 si su certeza no está presente.
        double alpha = imageCertainty != null ? weights.getImage() : 0.0;
        double beta = textCertainty != null ? weights.getText() : 0.0;
        double weightSum = alpha + beta;
        if (weightSum == 0.0) {
            return 0.0; // ninguna modalidad disponible
        }
        // Renormalizamos para que la suma de pesos presentes sea 1 (redistribuye el peso de la ausente).
        alpha /= weightSum;
        beta /= weightSum;

        double similarity = alpha * normalizeCosineScore(imageCertainty)
                + beta * normalizeCosineScore(textCertainty);
        return geoModulator(a, b) * similarity;
    }

    // ── EU-327: umbral calibrado y curva de presentación ────────────────────────────────────────

    /** Puntaje que se le MUESTRA al usuario cuando un match está justo en el umbral (75%). */
    public static final double DISPLAY_THRESHOLD = 0.75;

    /**
     * {@code true} si el puntaje combinado CRUDO alcanza el umbral calibrado en EU-327.
     *
     * <p>Se compara contra {@link ScoringProperties#getMatchThreshold()} —la escala real de
     * {@link #combinedScore}—, <b>no</b> contra el 0.75 que ve el usuario. Filtrar acá y no sobre el
     * puntaje ya remapeado es equivalente (la curva es monótona), pero deja el corte expresado en la
     * única escala en la que se lo puede volver a medir.</p>
     */
    public boolean isCombinedMatch(double combinedScore) {
        return combinedScore >= properties.getMatchThreshold();
    }

    /** Umbral crudo vigente. Expuesto sólo para loguearlo: el corte se decide en {@link #isCombinedMatch}. */
    public double matchThreshold() {
        return properties.getMatchThreshold();
    }

    /**
     * Remapea el puntaje combinado crudo al puntaje que se le muestra al usuario, vía
     * {@code mostrado = crudo^k}.
     *
     * <p><b>Por qué existe:</b> el umbral calibrado (~0.53) es el corte correcto según los datos, pero
     * mostrarle "53% de coincidencia" a alguien que está mirando SU objeto se lee como un fracaso. El
     * criterio de producto es que una coincidencia verdadera se presente con al menos 75%. Esta curva
     * hace esa traducción y nada más.</p>
     *
     * <p><b>Por qué no distorsiona el resultado:</b> es estrictamente creciente, así que <b>no altera
     * el orden</b> de los candidatos ni qué candidatos pasan el filtro. Es presentación, no ranking.
     * Además fija los extremos: 0 sigue siendo 0 y 1 sigue siendo 1.</p>
     *
     * <p>El exponente se <b>deriva</b> del umbral ({@code k = ln(0.75) / ln(umbral)}) en vez de ser una
     * segunda constante suelta: si se recalibra el umbral, el piso mostrado sigue cayendo en 75% solo,
     * sin que nadie tenga que acordarse de ajustar dos números a la vez.</p>
     *
     * @param combinedScore puntaje crudo de {@link #combinedScore}, en {@code [0, 1]}.
     * @return puntaje a mostrar, en {@code [0, 1]}; vale exactamente 0.75 cuando el crudo está en el umbral.
     */
    public double displayScore(double combinedScore) {
        if (combinedScore <= 0.0) {
            return 0.0;
        }
        double threshold = properties.getMatchThreshold();
        // Umbrales degenerados (<=0 o >=1) no definen una curva: se muestra el crudo sin remapear.
        if (threshold <= 0.0 || threshold >= 1.0) {
            return Math.min(combinedScore, 1.0);
        }
        double k = Math.log(DISPLAY_THRESHOLD) / Math.log(threshold);
        return Math.min(Math.pow(combinedScore, k), 1.0);
    }
}
