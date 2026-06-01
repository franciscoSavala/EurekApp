package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.ClaimStatus;
import com.eurekapp.backend.model.Reclamo;
import com.eurekapp.backend.model.UserEurekapp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface IReclamoRepository extends JpaRepository<Reclamo, Long> {

    @Query("SELECT COUNT(r) FROM Reclamo r WHERE r.user = :user AND r.createdAt >= :since")
    long countByUserAndCreatedAtAfter(@Param("user") UserEurekapp user, @Param("since") LocalDateTime since);
    List<Reclamo> findByOrganizationId(String orgId);
    List<Reclamo> findByOrganizationIdAndStatus(String orgId, ClaimStatus status);
    List<Reclamo> findByOrganizationIdAndCreatedAtBetween(String orgId, LocalDateTime from, LocalDateTime to);
    List<Reclamo> findByOrganizationIdAndStatusAndCreatedAtBetween(String orgId, ClaimStatus status, LocalDateTime from, LocalDateTime to);
    List<Reclamo> findByOrganizationIdAndFoundObjectCategory(String orgId, String category);
    Optional<Reclamo> findByOrganizationIdAndFoundObjectUUIDAndUser_Id(String orgId, String foundObjectUUID, Long userId);
    Optional<Reclamo> findByFoundObjectUUIDAndUser_Id(String foundObjectUUID, Long userId);
    Optional<Reclamo> findByFoundObjectUUIDAndStatus(String foundObjectUUID, ClaimStatus status);
    List<Reclamo> findByFoundObjectUUID(String foundObjectUUID);
    List<Reclamo> findByUser_Id(Long userId);
    long countByOrganizationIdAndUserAndStatus(String orgId, UserEurekapp user, ClaimStatus status);
    long countByOrganizationIdAndFoundObjectUUID(String organizationId, String foundObjectUUID);
}
