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

    /* EU-362: nombre y apellido de quien retira. La persona puede no tener cuenta en EurekApp, así
        que no alcanza con el usuario asociado: sin esto la devolución queda identificada sólo por un
        número de documento. Van nullable en la base porque las devoluciones anteriores al ticket no
        los tienen; para las nuevas son obligatorios y los valida el servicio. */
    @Column(name = "first_name", length = 100)
    private String firstName;

    @Column(name = "last_name", length = 100)
    private String lastName;

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

    // Empleado/usuario de la org que registró la devolución. Prerrequisito fraude Caso 3.
    @ManyToOne
    @JoinColumn(name = "returned_by_employee_id", nullable = true)
    private UserEurekapp returnedByEmployee;

    // Fecha y hora en que se envió la notificación al finder. Null si no se envió o hubo error.
    @Column(name = "notification_sent_at")
    private LocalDateTime notificationSentAt;

    // Email del finder al que se debe enviar la notificación. Permite reprocesar registros con notification_sent_at IS NULL.
    @Column(name = "notification_recipient")
    private String notificationRecipient;

    /* EU-371: organización donde se retiró el objeto. La devolución ya la conocía al registrarse,
       pero no la guardaba: había que ir a buscarla a la base vectorial. La calificación posterior al
       retiro se atribuye a esta organización, así que conviene tenerla acá y no reconstruirla.
       Nullable porque las devoluciones anteriores al ticket no la tienen. */
    @Column(name = "organization_id")
    private Long organizationId;
}