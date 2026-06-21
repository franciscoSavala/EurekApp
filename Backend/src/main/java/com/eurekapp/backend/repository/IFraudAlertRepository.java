package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.FraudAlert;
import com.eurekapp.backend.model.FraudAlertStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface IFraudAlertRepository extends JpaRepository<FraudAlert, Long> {

    // Todas las alertas (las nuevas son globales, organizationId=null): las gestiona el dueño de
    // Eurekapp / ADMIN (EU-287/288), no cada organización.
    List<FraudAlert> findAllByOrderByCreatedAtDesc();

    // Deduplicación de alertas (EU-284): evita crear otra alerta para la misma clave de agrupación
    // (dedupKey = "dni:"+DNI) dentro de la ventana vigente (creada después de 'since'). Es global
    // (sin organizationId) porque la detección de fraude es cross-organización y la alerta también.
    boolean existsByDedupKeyAndCreatedAtAfter(String dedupKey, LocalDateTime since);

    // Reporte de fraude global (EU-288): el rango de fechas determina qué alertas (y por ende qué
    // usuarios/DNIs) entran al reporte. El historial completo por usuario/DNI se trae aparte.
    List<FraudAlert> findByCreatedAtBetween(LocalDateTime from, LocalDateTime to);

    List<FraudAlert> findByStatusAndCreatedAtBetween(
            FraudAlertStatus status, LocalDateTime from, LocalDateTime to);

    // Historial completo (sin filtro de fecha) de un usuario sospechoso / de un DNI: alimenta el dato
    // de reincidencia (acumulado histórico) y el drill-down del reporte (EU-288).
    List<FraudAlert> findBySuspectUsers_Id(Long userId);

    List<FraudAlert> findByDni(String dni);
}
