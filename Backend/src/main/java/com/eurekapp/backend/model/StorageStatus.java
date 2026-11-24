package com.eurekapp.backend.model;

/** Estado de un objeto encontrado frente al plazo máximo de guarda de su organización (EU-452). */
public enum StorageStatus {
    IN_TERM,
    EXPIRING,
    EXPIRED
}
