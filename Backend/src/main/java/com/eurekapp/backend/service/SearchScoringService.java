package com.eurekapp.backend.service;

import com.eurekapp.backend.configuration.ScoringProperties;
import com.eurekapp.backend.model.GeoCoordinates;
import com.eurekapp.backend.model.ObjectCategory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Fuente de verdad ÚNICA del algoritmo de puntaje de coincidencias (ranking) de EurekApp.
 *
 * <p>Centraliza la fórmula con la que se decide cuán parecida es una publicación a una búsqueda,
 * el umbral de corte y la normalización de la certeza coseno. <b>No</b> consulta Weaviate ni conoce
 * entidades: opera sobre primitivos (certezas coseno + dos pares de coordenadas), por lo que sirve
 * igual para los dos sentidos de búsqueda gracias a que la certeza coseno es simétrica.</p>
 *
 * <p><b>Hay UNA sola fórmula</b> (EU-324): {@link #combinedScore} =
 * {@code geoModulator · (α·sim_img + β·sim_txt)}, con α/β por categoría. La buscar-sólo-texto es el
 * mismo cálculo con la certeza de imagen ausente, no una fórmula aparte.</p>
 *
 * <p><b>EU-337 retiró la fórmula legacy</b> (MOORA: 95% texto + 5% geografía). Ahí la geografía
 * SUMABA, de modo que estar cerca <i>compensaba</i> no parecerse: dos objetos distintos en la misma
 * esquina sumaban puntaje por estar juntos. Ahora la geografía MULTIPLICA, que es lo que de verdad
 * hace —atenúa una coincidencia según cuán lejos esté, y no puede inventar uno—.</p>
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

    /** Parámetros calibrables (α/β por categoría, piso geográfico), externalizados a configuración. */
    private final ScoringProperties properties;

    /**
     * Radio máximo de búsqueda en metros ({@code search.max-radius}), el MISMO que aplican como filtro
     * duro los repositorios. La curva geográfica se expresa en distancia relativa a este radio, así que
     * cambiarlo en configuración reajusta la curva sola (EU-337).
     */
    private final double maxRadius;

    public SearchScoringService(ScoringProperties properties,
                                @Value("${search.max-radius}") double maxRadius) {
        this.properties = properties;
        this.maxRadius = maxRadius;
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

    // ── EU-324: puntaje combinado imagen + texto por categoría ──────────────────────────────────

    /**
     * Fallback 50/50 para una categoría ausente en la configuración (o nula). Las ponderaciones
     * α/β reales por categoría, y el piso geográfico, viven en {@link ScoringProperties} —externas
     * a propósito, para calibrarlas (EU-327) sin recompilar.
     */
    private static final ScoringProperties.Weight DEFAULT_WEIGHT = new ScoringProperties.Weight(0.50, 0.50);

    /**
     * Constante de FORMA de la curva geográfica, adimensional: qué tan rápido cae el puntaje a medida
     * que uno se aleja, medido en <b>fracción del radio</b> y no en metros.
     *
     * <p>Vale {@code ln(1/0.95)/0.01 ≈ 5.129}, que es "al 1% del radio la curva ya cayó un 5%".
     * Es exactamente la intención de la constante original en metros (0.000102586589, elegida para
     * que 500 m sobre un radio de 50 km dieran 0.95), pero expresada de una forma que <b>no depende
     * del radio</b>: si mañana el radio pasa de 50 km a 15 km, la curva se reescala sola.</p>
     */
    private static final double GEO_SHAPE = Math.log(1 / 0.95) / 0.01;

    /** Valor de la exponencial de forma justo en el borde del radio; se resta para que ahí dé 0 exacto. */
    private static final double GEO_SHAPE_AT_EDGE = Math.exp(-GEO_SHAPE);

    /**
     * Factor por el que la geografía MODULA (multiplica) la suma de similitudes: mismo lugar → 1
     * exacto; borde del radio → {@code geoFloor} exacto. La geografía nunca anula un match, sólo lo
     * atenúa; el radio en sí es un filtro duro aparte, aplicado en el repositorio.
     *
     * <p><b>Por qué está anclada al radio en los dos extremos</b> (EU-337): el piso es lo que decide
     * cuánto puede castigar la distancia, y esa decisión se toma sobre el borde del radio ("un match
     * excelente en el punto más lejano admisible todavía se muestra con 80%"). Con la curva anterior,
     * expresada en metros, el valor en el borde dependía del radio por accidente y cambiar el radio
     * habría movido en silencio cuánto resta la distancia. Ahora {@code d/R} entra normalizado y el
     * borde cae en el piso por construcción, sea el radio el que sea.</p>
     *
     * @return factor de modulación en {@code [geoFloor, 1]}. Si falta alguna coordenada devuelve 1.0,
     *         pero es sólo una red de seguridad: la ubicación es OBLIGATORIA en la búsqueda (sin ella
     *         no se puede circunscribir el radio) y esa exigencia se valida aguas arriba.
     */
    public double geoModulator(GeoCoordinates a, GeoCoordinates b) {
        if (a == null || b == null) {
            return 1.0; // red de seguridad: no debería ocurrir (la ubicación es obligatoria)
        }
        double geoFloor = properties.getGeoFloor();
        if (maxRadius <= 0) {
            return geoFloor; // radio degenerado: sin escala no hay curva, se aplica el castigo máximo
        }
        // Distancia relativa al radio, topeada en 1: fuera del radio ya no hay nada que graduar (y no
        // debería llegar acá, porque el radio es un filtro duro aguas arriba).
        double relativeDistance = Math.min(CommonFunctions.calculateGeoDistance(a, b) / maxRadius, 1.0);
        double shape = (Math.exp(-GEO_SHAPE * relativeDistance) - GEO_SHAPE_AT_EDGE)
                / (1.0 - GEO_SHAPE_AT_EDGE); // 1 en el centro, 0 en el borde
        return geoFloor + (1.0 - geoFloor) * shape;
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
     * Modo de búsqueda. <b>Cada modo tiene su propio umbral crudo</b> (EU-337): con foto se promedian
     * dos parecidos y sin foto uno solo, así que los puntajes NO viven en la misma escala y un mismo
     * número crudo no significa lo mismo en los dos. Calibrando uno por modo —y remapeando cada uno
     * con su propia curva—, el porcentaje que ve el usuario sí significa lo mismo en los dos casos,
     * que es exactamente lo que hace falta ahora que las dos búsquedas comparten pantalla.
     */
    public enum SearchMode {
        /** Búsqueda con foto: imagen + texto. */
        WITH_PHOTO,
        /** Búsqueda sólo con texto (y la notificación de una búsqueda guardada sin foto). */
        TEXT_ONLY
    }

    /**
     * {@code true} si el puntaje combinado CRUDO alcanza el umbral calibrado del modo.
     *
     * <p>Se compara contra el umbral crudo —la escala real de {@link #combinedScore}—, <b>no</b>
     * contra el 0.75 que ve el usuario. Filtrar acá y no sobre el puntaje ya remapeado es equivalente
     * (la curva es monótona), pero deja el corte expresado en la única escala en la que se lo puede
     * volver a medir.</p>
     */
    public boolean isCombinedMatch(double combinedScore, SearchMode mode) {
        return combinedScore >= matchThreshold(mode);
    }

    /** Umbral crudo vigente para el modo. Expuesto además para loguearlo. */
    public double matchThreshold(SearchMode mode) {
        return mode == SearchMode.TEXT_ONLY
                ? properties.getTextMatchThreshold()
                : properties.getMatchThreshold();
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
     * sin que nadie tenga que acordarse de ajustar dos números a la vez. Por lo mismo, <b>cada modo
     * usa SU umbral</b> (EU-337): así el 75% del piso significa lo mismo con foto y sin foto.</p>
     *
     * @param combinedScore puntaje crudo de {@link #combinedScore}, en {@code [0, 1]}.
     * @param mode modo de búsqueda, que elige el umbral desde el que se deriva la curva.
     * @return puntaje a mostrar, en {@code [0, 1]}; vale exactamente 0.75 cuando el crudo está en el umbral.
     */
    public double displayScore(double combinedScore, SearchMode mode) {
        if (combinedScore <= 0.0) {
            return 0.0;
        }
        double threshold = matchThreshold(mode);
        // Umbrales degenerados (<=0 o >=1) no definen una curva: se muestra el crudo sin remapear.
        if (threshold <= 0.0 || threshold >= 1.0) {
            return Math.min(combinedScore, 1.0);
        }
        double k = Math.log(DISPLAY_THRESHOLD) / Math.log(threshold);
        return Math.min(Math.pow(combinedScore, k), 1.0);
    }
}
