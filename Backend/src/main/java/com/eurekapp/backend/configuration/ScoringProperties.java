package com.eurekapp.backend.configuration;

import com.eurekapp.backend.model.ObjectCategory;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.EnumMap;
import java.util.Map;

/**
 * Parámetros calibrables del puntaje de coincidencias (EU-324), externalizados a configuración
 * (prefijo {@code search.scoring} en application.yml) para poder ajustarlos <b>sin recompilar</b>:
 * basta editar el yml (o una variable de entorno) y reiniciar. Es lo que necesita la etapa de
 * calibración empírica (EU-327), donde se prueban varias combinaciones de α/β y del piso geográfico.
 *
 * <p>Trae los <b>valores iniciales por defecto en código</b>, de modo que si la configuración no
 * define nada (o define sólo algunas categorías) el sistema igual arranca con valores razonables.</p>
 */
@ConfigurationProperties(prefix = "search.scoring")
public class ScoringProperties {

    /**
     * Piso del modulador geográfico: cuánto vale la geografía JUSTO EN EL BORDE del radio (en el
     * centro vale 1). Es lo que decide cuánto puede llegar a restar la distancia.
     *
     * <p>No es un número puesto a ojo: sale de la regla de producto (EU-337) de que <b>una
     * coincidencia excelente no puede desaparecer del radar por estar lejos</b> — concretamente, el
     * mejor par del seed (similitud 0.8032), llevado al punto más lejano admisible, todavía se le
     * muestra al usuario con <b>80%</b>. Eso fija el piso en 0.7631.</p>
     */
    private double geoFloor = 0.7631;

    /** Ponderaciones α (imagen) / β (texto) por categoría. Conviene que {@code image + text = 1}. */
    private Map<ObjectCategory, Weight> weights = defaultWeights();

    /**
     * Umbral CRUDO de coincidencia del puntaje combinado (EU-327), sobre la escala real que devuelve
     * {@code combinedScore}. Calibrado empíricamente sobre los 5 pares verdaderos del seed: el peor
     * par (el paraguas, catálogo vs calle) puntúa 0.5820, y se le resta un margen de 0.05 de seguridad.
     *
     * <p><b>No es el número que ve el usuario.</b> La presentación se remapea con
     * {@code SearchScoringService.displayScore}, que lleva este umbral a 0.75 exactamente.</p>
     */
    private double matchThreshold = 0.5320;

    /**
     * Umbral CRUDO de coincidencia de la búsqueda SÓLO TEXTO (EU-337). Es un número aparte del de la
     * búsqueda con foto porque las dos escalas son distintas: con foto se promedian dos parecidos y
     * sin foto queda uno solo. Cada uno se remapea con su propia curva, y así el porcentaje que ve el
     * usuario significa lo mismo en los dos casos —que es lo que hace falta ahora que las dos
     * búsquedas comparten pantalla—.
     */
    private double textMatchThreshold = 0.4968;

    public double getTextMatchThreshold() {
        return textMatchThreshold;
    }

    public void setTextMatchThreshold(double textMatchThreshold) {
        this.textMatchThreshold = textMatchThreshold;
    }

    public double getGeoFloor() {
        return geoFloor;
    }

    public void setGeoFloor(double geoFloor) {
        this.geoFloor = geoFloor;
    }

    public double getMatchThreshold() {
        return matchThreshold;
    }

    public void setMatchThreshold(double matchThreshold) {
        this.matchThreshold = matchThreshold;
    }

    public Map<ObjectCategory, Weight> getWeights() {
        return weights;
    }

    public void setWeights(Map<ObjectCategory, Weight> weights) {
        this.weights = weights;
    }

    /** Ponderación de una categoría: peso de la imagen (α) y peso del texto (β). */
    public static class Weight {
        private double image = 0.5;
        private double text = 0.5;

        public Weight() {
        }

        public Weight(double image, double text) {
            this.image = image;
            this.text = text;
        }

        public double getImage() {
            return image;
        }

        public void setImage(double image) {
            this.image = image;
        }

        public double getText() {
            return text;
        }

        public void setText(double text) {
            this.text = text;
        }
    }

    /**
     * Valores iniciales del rework (decisión 4): en billetera/credenciales el texto (DNI, nombre)
     * distingue más que la foto (muchas se parecen); en ropa el texto ensucia (β bajo); electrónica
     * y llaves quedan ~50/50. Son un punto de partida; se recalibran en EU-327.
     */
    private static Map<ObjectCategory, Weight> defaultWeights() {
        Map<ObjectCategory, Weight> defaults = new EnumMap<>(ObjectCategory.class);
        defaults.put(ObjectCategory.BILLETERA, new Weight(0.35, 0.65));
        defaults.put(ObjectCategory.ROPA, new Weight(0.85, 0.15));
        defaults.put(ObjectCategory.ELECTRONICA, new Weight(0.50, 0.50));
        defaults.put(ObjectCategory.LLAVES, new Weight(0.50, 0.50));
        defaults.put(ObjectCategory.OTROS, new Weight(0.50, 0.50));
        return defaults;
    }
}
