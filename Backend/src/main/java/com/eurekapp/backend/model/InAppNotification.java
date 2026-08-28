package com.eurekapp.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "in_app_notifications")
public class InAppNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private UserEurekapp user;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 500)
    private String description;

    @Column(nullable = false, length = 50)
    private String type;

    @Column(name = "is_read", nullable = false)
    @Builder.Default
    private boolean read = false;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "related_request_id")
    private Long relatedRequestId;

    /**
     * EU-345: UUID del objeto encontrado que disparó el aviso (tipo MATCH_FOUND). No se puede
     * reusar relatedRequestId porque es un Long y los objetos viven en Weaviate, identificados por
     * UUID. Sin este dato la notificación avisa que apareció algo parecido y ahí termina: no hay
     * forma de llevar al usuario al objeto, que es lo que reportó EU-345.
     */
    @Column(name = "related_object_uuid", length = 36)
    private String relatedObjectUuid;

    /**
     * EU-345: puntaje que disparó el aviso, en la escala de display (0-1), la misma que devuelve la
     * búsqueda en vivo. Un aviso agrupa TODAS las búsquedas guardadas del usuario que coincidieron
     * con el objeto, y cada una tiene su propio puntaje: se guarda el MAYOR.
     *
     * <p>Se persiste en lugar de recalcularlo al abrir el aviso, y es a propósito: es el número por
     * el que se le avisó al usuario.</p>
     */
    @Column(name = "match_score")
    private Double matchScore;

    /**
     * UUID de la búsqueda guardada que mejor coincidió con el objeto. Es lo que permite, cuando el
     * usuario dice "Este es mi objeto", saber CUÁL de sus búsquedas pasa a "Por retirar": la
     * pantalla de coincidencias por sí sola no lo sabe.
     */
    @Column(name = "related_lost_object_uuid", length = 36)
    private String relatedLostObjectUuid;
}
