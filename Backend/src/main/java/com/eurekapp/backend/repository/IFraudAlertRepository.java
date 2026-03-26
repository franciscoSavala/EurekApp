package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.FraudAlert;
import com.eurekapp.backend.model.FraudAlertStatus;
import com.eurekapp.backend.model.UserEurekapp;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IFraudAlertRepository extends JpaRepository<FraudAlert, Long> {

    List<FraudAlert> findByOrganizationIdOrderByCreatedAtDesc(String organizationId);

    boolean existsByOrganizationIdAndFoundObjectUUIDAndSuspectUserAndReasonAndStatus(
            String organizationId,
            String foundObjectUUID,
            UserEurekapp suspectUser,
            String reason,
            FraudAlertStatus status);
}
