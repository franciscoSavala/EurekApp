package com.eurekapp.backend.repository;

import java.time.Duration;

public interface ObjectStorage {
    byte[] getObjectBytes(String keyName);
    void putObject(byte[] data, String objectKey);
    String getObjectUrl(String objectKey);
    String generatePresignedUrl(String objectKey, Duration expiry);
}
