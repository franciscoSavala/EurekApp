package com.eurekapp.backend.service;

import com.eurekapp.backend.model.Location;

public interface ILocationService {
    Double calculateLocationSimilarity(Location source, Location destination);
}
