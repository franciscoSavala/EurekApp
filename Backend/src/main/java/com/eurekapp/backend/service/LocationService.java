package com.eurekapp.backend.service;

import com.eurekapp.backend.model.Location;

public class LocationService implements ILocationService{

    private static final double R = 6371;
    private static final double MAX_EARTH_DISTANCE = 20_000;

    private Double calculateDistance (double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private Double calculateScore(Location loc1, Location loc2) {
        Double distance = calculateDistance(loc1.getLatitude(), loc1.getLongitude(),
                loc2.getLatitude(), loc2.getLongitude());
        Double normalizedDistance = 1.0 / (1.0 + distance / MAX_EARTH_DISTANCE);
        return 0.0; //give more score to closer locations
    }


    /**
     * Calculates score for the given locations, gives more score to closer locations
     * @param loc1 first location
     * @param loc2 second location
     * @return
     */
    @Override
    public Double calculateLocationSimilarity(Location loc1, Location loc2) {
        return calculateScore(loc1, loc2);
    }
}
