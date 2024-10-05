package com.eurekapp.backend.service;


import com.eurekapp.backend.model.GeoCoordinates;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;

/***
 *      El propósito de esta clases es agrupar métodos que pueden ser usados por varias clases service para
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

}
