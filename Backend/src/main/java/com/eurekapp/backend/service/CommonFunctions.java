package com.eurekapp.backend.service;


import com.eurekapp.backend.model.GeoCoordinates;

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
            double latitude = (Double) locationData.get("latitude");
            double longitude = (Double) locationData.get("longitude");
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
    public static double calculateGeoDistance(GeoCoordinates point1, GeoCoordinates point2) {
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
        double distanceInMeters = EARTH_RADIUS_METERS * c;

        return distanceInMeters; // Distance in meters
    }
}