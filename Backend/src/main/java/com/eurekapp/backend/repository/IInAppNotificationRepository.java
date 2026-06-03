package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.InAppNotification;
import com.eurekapp.backend.model.UserEurekapp;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface IInAppNotificationRepository extends JpaRepository<InAppNotification, Long> {

    List<InAppNotification> findByUserOrderByCreatedAtDesc(UserEurekapp user);

    long countByUserAndReadFalse(UserEurekapp user);

    Optional<InAppNotification> findByIdAndUser(Long id, UserEurekapp user);

    Optional<InAppNotification> findByRelatedRequestId(Long relatedRequestId);
}
