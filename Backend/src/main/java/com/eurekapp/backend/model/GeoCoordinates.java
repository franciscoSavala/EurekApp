package com.eurekapp.backend.model;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class GeoCoordinates {

    private double latitude;
    private double longitude;

}
