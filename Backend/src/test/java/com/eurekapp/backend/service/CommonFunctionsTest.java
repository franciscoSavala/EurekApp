package com.eurekapp.backend.service;

import com.eurekapp.backend.model.GeoCoordinates;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class CommonFunctionsTest {

    // --- calculateGeoDistance ---

    @Test
    void calculateGeoDistance_samePoint_returnsZero() {
        GeoCoordinates point = GeoCoordinates.builder().latitude(-31.4).longitude(-64.18).build();

        Double distance = CommonFunctions.calculateGeoDistance(point, point);

        assertThat(distance).isEqualTo(0.0);
    }

    @Test
    void calculateGeoDistance_cordobaCapitalToUTN_returnsReasonableDistance() {
        // UTN FRC (Córdoba) ≈ (-31.3666, -64.1944)
        // Plaza San Martín Córdoba ≈ (-31.4135, -64.1820)
        // Real distance ≈ ~5.4 km
        GeoCoordinates utn = GeoCoordinates.builder().latitude(-31.3666).longitude(-64.1944).build();
        GeoCoordinates plaza = GeoCoordinates.builder().latitude(-31.4135).longitude(-64.1820).build();

        Double distanceMeters = CommonFunctions.calculateGeoDistance(utn, plaza);

        // Tolerance ±500 meters
        assertThat(distanceMeters).isCloseTo(5400.0, within(500.0));
    }

    @Test
    void calculateGeoDistance_overloadWithDoubles_returnsSymmetricResult() {
        Double d1 = CommonFunctions.calculateGeoDistance(-31.3666, -64.1944, -31.4135, -64.1820);
        Double d2 = CommonFunctions.calculateGeoDistance(-31.4135, -64.1820, -31.3666, -64.1944);

        assertThat(d1).isCloseTo(d2, within(0.001));
    }

    // --- calculateGeoScore ---

    @Test
    void calculateGeoScore_samePoint_returnsOne() {
        GeoCoordinates point = GeoCoordinates.builder().latitude(-31.4).longitude(-64.18).build();

        Double score = CommonFunctions.calculateGeoScore(point, point);

        assertThat(score).isCloseTo(1.0, within(0.001));
    }

    @Test
    void calculateGeoScore_500MetersApart_returnsApproximately0_95() {
        // k = 0.000102586589, so score at 500m ≈ e^(-0.000102586589 * 500) ≈ 0.95
        // Use Buenos Aires and a point ~500m away
        GeoCoordinates p1 = GeoCoordinates.builder().latitude(-34.6037).longitude(-58.3816).build();
        GeoCoordinates p2 = GeoCoordinates.builder().latitude(-34.6082).longitude(-58.3816).build(); // ~500m south

        Double score = CommonFunctions.calculateGeoScore(p1, p2);

        assertThat(score).isBetween(0.90, 1.0);
    }

    @Test
    void calculateGeoScore_veryFarPoints_returnsLowScore() {
        GeoCoordinates cordoba = GeoCoordinates.builder().latitude(-31.4).longitude(-64.18).build();
        GeoCoordinates buenosAires = GeoCoordinates.builder().latitude(-34.6).longitude(-58.38).build();
        // ~680 km apart → score should be near 0

        Double score = CommonFunctions.calculateGeoScore(cordoba, buenosAires);

        assertThat(score).isLessThan(0.001);
    }

    // --- convertToLocalDateTime ---

    @Test
    void convertToLocalDateTime_validIsoString_parsesCorrectly() {
        String dateString = "2024-06-15T10:30:00Z";

        LocalDateTime result = CommonFunctions.convertToLocalDateTime(dateString);

        assertThat(result.getYear()).isEqualTo(2024);
        assertThat(result.getMonthValue()).isEqualTo(6);
        assertThat(result.getDayOfMonth()).isEqualTo(15);
        assertThat(result.getHour()).isEqualTo(10);
    }

    @Test
    void convertToLocalDateTime_nullInput_returnsNull() {
        assertThat(CommonFunctions.convertToLocalDateTime(null)).isNull();
    }

    // --- convertToGeoCoordinates ---

    @Test
    void convertToGeoCoordinates_validMap_returnsCoordinates() {
        Map<String, Object> locationData = Map.of("latitude", -31.4, "longitude", -64.18);

        GeoCoordinates result = CommonFunctions.convertToGeoCoordinates(locationData);

        assertThat(result.getLatitude()).isEqualTo(-31.4);
        assertThat(result.getLongitude()).isEqualTo(-64.18);
    }

    @Test
    void convertToGeoCoordinates_nullMap_returnsNull() {
        assertThat(CommonFunctions.convertToGeoCoordinates(null)).isNull();
    }
}
