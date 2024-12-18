package com.eurekapp.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import java.time.LocalDateTime;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "return_found_objects")
public class ReturnFoundObject {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Usuario de la persona que se lleva el objeto consigo. Puede ser null, si la persona que lo devuelve no usa la app.
    @ManyToOne
    @JoinColumn(name = "user_id", nullable = true)
    private UserEurekapp userEurekapp;

    /* Es String porque no lo usaremos para hacer operaciones matemáticas, y para no tener que lidiar
        con la posibilidad de que ocurra un overflow. */
    @Column(nullable = false, length = 20)
    private String DNI;

    // Ídem al atributo anterior.
    @Column(nullable = false, length = 20)
    private String phoneNumber;

    // UUID del objeto devuelto.
    @Column(nullable = false, unique = true)
    private String foundObjectUUID;

    // UUID de la foto de la persona que se llevó el objeto
    @Column(name="person_photo_UUID", nullable=false)
    private String personPhotoUUID;

    // Fecha y hora de la transacción.
    @Column(nullable = false)
    private LocalDateTime datetimeOfReturn;
}