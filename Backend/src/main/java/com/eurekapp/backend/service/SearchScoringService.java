package com.eurekapp.backend.service;

import com.eurekapp.backend.model.GeoCoordinates;
import org.springframework.stereotype.Service;

/**
 * Fuente de verdad ÚNICA del algoritmo de puntaje de coincidencias (ranking) de EurekApp.
 *
 * <p>Centraliza la fórmula con la que se decide cuán parecida es una publicación a una búsqueda:
 * la normalización de la certeza coseno, su combinación con la cercanía geográfica (MOORA 95/5)
 * y el umbral de corte. <b>No</b> consulta Weaviate ni conoce entidades: opera sobre primitivos
 * (certeza coseno + dos pares de coordenadas), por lo que sirve igual para los dos sentidos de
 * búsqueda gracias a que la certeza coseno es simétrica.</p>
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
}
