package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.OrganizationFeedback;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface IOrganizationFeedbackRepository extends JpaRepository<OrganizationFeedback, Long> {

    // Una devolucion admite una sola calificacion (EU-371).
    boolean existsByReturnFoundObject_Id(Long returnFoundObjectId);

    Optional<OrganizationFeedback> findByReturnFoundObject_Id(Long returnFoundObjectId);

    // Fuente del reporte del responsable de organizacion (EU-375): solo su propia organizacion.
    List<OrganizationFeedback> findByOrganizationIdAndCreatedAtBetween(
            Long organizationId, LocalDateTime from, LocalDateTime to);
}
