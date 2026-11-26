package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.SearchFeedback;
import com.eurekapp.backend.model.UserEurekapp;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface ISearchFeedbackRepository extends JpaRepository<SearchFeedback, Long> {
    List<SearchFeedback> findByOrganization_IdAndCreatedAtBetween(
            Long organizationId, LocalDateTime from, LocalDateTime to);

    List<SearchFeedback> findByCreatedAtBetween(LocalDateTime from, LocalDateTime to);

    long countByOrganization_IdAndFoundObjectUUIDAndWasFoundTrue(Long organizationId, String foundObjectUUID);

    List<SearchFeedback> findByOrganization_IdAndFoundObjectUUIDAndWasFoundTrue(Long organizationId, String foundObjectUUID);

    long countByOrganization_IdAndUserAndWasFoundTrueAndCreatedAtAfter(
            Long organizationId, UserEurekapp user, LocalDateTime after);
}
