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

    /** Piso del modulador geográfico dentro del radio (decisión 6 / sección 3: rango 0.75–1). */
    private double geoFloor = 0.75;

    /** Ponderaciones α (imagen) / β (texto) por categoría. Conviene que {@code image + text = 1}. */
    private Map<ObjectCategory, Weight> weights = defaultWeights();

    public double getGeoFloor() {
        return geoFloor;
    }

    public void setGeoFloor(double geoFloor) {
        this.geoFloor = geoFloor;
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
     * distingue más que la foto (muchas se parecen); en ropa el texto ensucia (β bajo); celular y
     * llaves quedan ~50/50. Son un punto de partida; se recalibran en EU-327.
     */
    private static Map<ObjectCategory, Weight> defaultWeights() {
        Map<ObjectCategory, Weight> defaults = new EnumMap<>(ObjectCategory.class);
        defaults.put(ObjectCategory.BILLETERA, new Weight(0.35, 0.65));
        defaults.put(ObjectCategory.ROPA, new Weight(0.85, 0.15));
        defaults.put(ObjectCategory.CELULAR, new Weight(0.50, 0.50));
        defaults.put(ObjectCategory.LLAVES, new Weight(0.50, 0.50));
        defaults.put(ObjectCategory.OTROS, new Weight(0.50, 0.50));
        return defaults;
    }
}
