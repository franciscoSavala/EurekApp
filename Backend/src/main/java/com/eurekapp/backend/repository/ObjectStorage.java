package com.eurekapp.backend.repository;

public interface ObjectStorage {
    byte[] getObjectBytes(String keyName);
    void putObject(byte[] data, String objectKey);
}
