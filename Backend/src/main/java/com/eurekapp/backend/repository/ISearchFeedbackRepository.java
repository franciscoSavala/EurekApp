package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.SearchFeedback;
import com.eurekapp.backend.model.UserEurekapp;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface ISearchFeedbackRepository extends JpaRepository<SearchFeedback, Long> {
    List<SearchFeedback> findByOrganizationIdAndCreatedAtBetween(
            String organizationId, LocalDateTime from, LocalDateTime to);

    long countByOrganizationIdAndFoundObjectUUIDAndWasFoundTrue(String organizationId, String foundObjectUUID);

    long countByOrganizationIdAndUserAndWasFoundTrueAndCreatedAtAfter(
            String organizationId, UserEurekapp user, LocalDateTime after);
}
