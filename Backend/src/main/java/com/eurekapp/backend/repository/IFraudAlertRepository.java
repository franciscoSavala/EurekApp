package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.FraudAlert;
import com.eurekapp.backend.model.FraudAlertStatus;
import com.eurekapp.backend.model.UserEurekapp;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface IFraudAlertRepository extends JpaRepository<FraudAlert, Long> {

    List<FraudAlert> findByOrganizationIdOrderByCreatedAtDesc(String organizationId);

    boolean existsByOrganizationIdAndFoundObjectUUIDAndSuspectUserAndReasonAndStatus(
            String organizationId,
            String foundObjectUUID,
            UserEurekapp suspectUser,
            String reason,
            FraudAlertStatus status);

    List<FraudAlert> findByOrganizationIdAndCreatedAtBetween(
            String organizationId, LocalDateTime from, LocalDateTime to);

    List<FraudAlert> findByOrganizationIdAndStatusAndCreatedAtBetween(
            String organizationId, FraudAlertStatus status, LocalDateTime from, LocalDateTime to);

    boolean existsByOrganizationIdAndSuspectUser_IdAndStatus(
            String organizationId, Long userId, FraudAlertStatus status);
}
