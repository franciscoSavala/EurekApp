package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.ClaimStatus;
import com.eurekapp.backend.model.Reclamo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface IReclamoRepository extends JpaRepository<Reclamo, Long> {
    List<Reclamo> findByOrganizationId(String orgId);
    List<Reclamo> findByOrganizationIdAndStatus(String orgId, ClaimStatus status);
    List<Reclamo> findByOrganizationIdAndCreatedAtBetween(String orgId, LocalDateTime from, LocalDateTime to);
    List<Reclamo> findByOrganizationIdAndStatusAndCreatedAtBetween(String orgId, ClaimStatus status, LocalDateTime from, LocalDateTime to);
    List<Reclamo> findByOrganizationIdAndFoundObjectCategory(String orgId, String category);
    Optional<Reclamo> findByOrganizationIdAndFoundObjectUUIDAndUser_Id(String orgId, String foundObjectUUID, Long userId);
}
