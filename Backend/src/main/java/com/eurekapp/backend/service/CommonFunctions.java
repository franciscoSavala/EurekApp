package com.eurekapp.backend.service;


import com.eurekapp.backend.model.GeoCoordinates;
import org.springframework.beans.factory.annotation.Value;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;

/***
 *      El propósito de esta clase es agrupar métodos que pueden ser usados por varias clases service para
 *      implementarlos una sola vez.
 *
 * ***/
public class CommonFunctions {

    @Value("${search.max-radius}")
    private double maxRadius;

    // Constant for date format
    public static final String DATE_FORMAT = "yyyy-MM-dd";

    // Constructor privado para prevenir instanciación.
    private CommonFunctions() {
        throw new UnsupportedOperationException("Utility class cannot be instantiated");
    }

    public static LocalDateTime convertToLocalDateTime(String dateString) {
        if (dateString != null) {
            OffsetDateTime offsetDateTime = OffsetDateTime.parse(dateString);
            return offsetDateTime.atZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        }
        return null; // O lanza una excepción, dependiendo de cómo quieras manejar los valores nulos.
    }

    public static GeoCoordinates convertToGeoCoordinates(Map<String, Object> locationData) {
        if (locationData != null) {
            Double latitude = (Double) locationData.get("latitude");
            Double longitude = (Double) locationData.get("longitude");
            return GeoCoordinates.builder()
                    .latitude(latitude)
                    .longitude(longitude)
                    .build();
        }
        return null;
    }


    /***
     *      Método que, dados dos pares de coordenadas, devuelve la distancia en línea recta en metros entre ambos puntos.
     *      Este método usa la fórmula de Haversine, que presenta un cierto error por asumir que la Tierra es esférica.
     *      Como siempre calcularemos distancias menores a 100 km, este error es de unos pocos metros, y es aceptable.
     * ***/
    public static Double calculateGeoDistance(GeoCoordinates point1, GeoCoordinates point2) {
        // Radius of the Earth in meters
        final double EARTH_RADIUS_METERS = 6371000;

        // Convert latitude and longitude from degrees to radians
        double latitude1InRadians = Math.toRadians(point1.getLatitude());
        double latitude2InRadians = Math.toRadians(point2.getLatitude());
        double deltaLatitudeInRadians = Math.toRadians(point2.getLatitude() - point1.getLatitude());
        double deltaLongitudeInRadians = Math.toRadians(point2.getLongitude() - point1.getLongitude());

        // Haversine formula
        double a = Math.sin(deltaLatitudeInRadians / 2) * Math.sin(deltaLatitudeInRadians / 2) +
                Math.cos(latitude1InRadians) * Math.cos(latitude2InRadians) *
                        Math.sin(deltaLongitudeInRadians / 2) * Math.sin(deltaLongitudeInRadians / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        // Calculate the distance
        Double distanceInMeters = EARTH_RADIUS_METERS * c;

        return distanceInMeters; // Distance in meters
    }

    public static Double calculateGeoDistance(Double latitude1, Double longitude1, Double latitude2, Double longitude2) {
        GeoCoordinates point1 = GeoCoordinates.builder()
                .latitude(latitude1)
                .longitude(longitude1)
                .build();
        GeoCoordinates point2 = GeoCoordinates.builder()
                .latitude(latitude2)
                .longitude(longitude2)
                .build();
        return calculateGeoDistance(point1, point2); // Distance in meters
    }

    public static Double calculateGeoScore(GeoCoordinates point1, GeoCoordinates point2){
        // 1- Calculamos la distancia entre ambos puntos
        Double distance = calculateGeoDistance(point1, point2);

        /* 2- Con la siguiente función, calculamos el score geográfico:
            score = e**(-k*d)
            donde k es una constante y d es la distancia en metros.
            Definimos "k" igual a 0.000102586589, para que el score de una distancia de 500 metros sea igual a 0.95.
         */
        final Double k = 0.000102586589;
        return Math.exp(-k * distance);
    }
}