package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.FraudAlert;
import com.eurekapp.backend.model.FraudAlertStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface IFraudAlertRepository extends JpaRepository<FraudAlert, Long> {

    List<FraudAlert> findByOrganizationIdOrderByCreatedAtDesc(String organizationId);

    // Deduplicación de alertas: evita crear una alerta repetida si ya existe otra de la misma
    // regla (reason), para la misma clave de agrupación (dedupKey), dentro de la ventana de
    // tiempo vigente (creada después de 'since'). Es el criterio (regla, clave, ventana).
    boolean existsByOrganizationIdAndReasonAndDedupKeyAndCreatedAtAfter(
            String organizationId, String reason, String dedupKey, LocalDateTime since);

    List<FraudAlert> findByOrganizationIdAndCreatedAtBetween(
            String organizationId, LocalDateTime from, LocalDateTime to);

    List<FraudAlert> findByOrganizationIdAndStatusAndCreatedAtBetween(
            String organizationId, FraudAlertStatus status, LocalDateTime from, LocalDateTime to);

    boolean existsByOrganizationIdAndSuspectUsers_IdAndStatus(
            String organizationId, Long userId, FraudAlertStatus status);

    List<FraudAlert> findByOrganizationIdAndSuspectUsers_Id(String organizationId, Long userId);
}
