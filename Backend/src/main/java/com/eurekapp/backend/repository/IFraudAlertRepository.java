package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.FraudAlert;
import com.eurekapp.backend.model.FraudAlertStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface IFraudAlertRepository extends JpaRepository<FraudAlert, Long> {

    List<FraudAlert> findByOrganizationIdOrderByCreatedAtDesc(String organizationId);

    // Deduplicación de alertas (EU-284): evita crear otra alerta para la misma clave de agrupación
    // (dedupKey = "dni:"+DNI) dentro de la ventana vigente (creada después de 'since'). Es global
    // (sin organizationId) porque la detección de fraude es cross-organización y la alerta también.
    boolean existsByDedupKeyAndCreatedAtAfter(String dedupKey, LocalDateTime since);

    List<FraudAlert> findByOrganizationIdAndCreatedAtBetween(
            String organizationId, LocalDateTime from, LocalDateTime to);

    List<FraudAlert> findByOrganizationIdAndStatusAndCreatedAtBetween(
            String organizationId, FraudAlertStatus status, LocalDateTime from, LocalDateTime to);

    boolean existsByOrganizationIdAndSuspectUsers_IdAndStatus(
            String organizationId, Long userId, FraudAlertStatus status);

    List<FraudAlert> findByOrganizationIdAndSuspectUsers_Id(String organizationId, Long userId);
}
