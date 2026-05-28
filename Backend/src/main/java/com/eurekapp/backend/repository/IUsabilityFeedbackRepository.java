package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.UsabilityFeedback;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface IUsabilityFeedbackRepository extends JpaRepository<UsabilityFeedback, Long> {

    List<UsabilityFeedback> findByUser_Organization_IdAndCreatedAtBetween(
            Long orgId, LocalDateTime from, LocalDateTime to);
}
