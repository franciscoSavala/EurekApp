package com.eurekapp.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * EU-371: la calificación que una persona le da a la organización DESPUÉS de retirar su objeto.
 *
 * Cuelga de la devolución concreta y no de la búsqueda: recién ahí la persona trató con la
 * organización —esperó, la atendieron, recibió el objeto en algún estado— y puede opinar. La
 * calificación que se pedía en la pantalla de resultados se daba antes de todo eso.
 *
 * La devolución es también lo que garantiza que se califique una sola vez, y a la organización
 * correcta: la relación es uno a uno.
 */
@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "organization_feedback")
public class OrganizationFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(optional = false)
    @JoinColumn(name = "return_found_object_id", nullable = false, unique = true)
    private ReturnFoundObject returnFoundObject;

    /* Se copia de la devolución en vez de recorrerla en cada consulta: el reporte del responsable
     * de organización filtra por acá, y así no depende de la base vectorial ni de un join extra. */
    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    // Quien retiró el objeto. Siempre tiene cuenta: a la encuesta se llega desde su propio correo.
    @ManyToOne
    @JoinColumn(name = "user_id", nullable = true)
    private UserEurekapp user;

    // Los cinco aspectos, cada uno de 1 a 5. Son un promedio por aspecto en el reporte, no uno solo:
    // un promedio único dice que algo anda mal, pero no qué corregir.
    @Column(name = "staff_treatment", nullable = false)
    private Integer staffTreatment;

    @Column(name = "waiting_time", nullable = false)
    private Integer waitingTime;

    @Column(name = "instructions_clarity", nullable = false)
    private Integer instructionsClarity;

    @Column(name = "object_condition", nullable = false)
    private Integer objectCondition;

    @Column(name = "pickup_security", nullable = false)
    private Integer pickupSecurity;

    @Column(name = "comment", nullable = true, length = 500)
    private String comment;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
