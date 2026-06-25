package com.eurekapp.backend.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "fraud_detection_config")
public class FraudDetectionConfig {

    // Singleton: siempre id=1
    @Id
    private Long id;

    // N: cantidad de devoluciones dentro de la ventana que dispara una regla
    @Column(name = "fraud_threshold", nullable = false)
    private int fraudThreshold;

    // T: duración de la ventana deslizante en días (período de detección)
    @Column(name = "fraud_window_days", nullable = false)
    private int fraudWindowDays;

    // Duración del bloqueo en días: cuánto dura la sanción. Independiente de T (que es el período
    // de detección). Política del dueño de Eurekapp, configurable vía endpoint admin.
    @Column(name = "block_duration_days", nullable = false)
    private int blockDurationDays;
}
