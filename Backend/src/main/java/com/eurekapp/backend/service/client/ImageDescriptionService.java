package com.eurekapp.backend.service.client;

public interface ImageDescriptionService {
    String getImageTextRepresentation(byte[] bytes);
    String expandSearchQuery(String query);
}
