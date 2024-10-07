package com.eurekapp.backend.service;

import com.eurekapp.backend.model.Location;

public interface ILocationService {
    Double calculateLocationSimilarity(Location loc1, Location loc2);
}
