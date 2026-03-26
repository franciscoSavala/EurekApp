package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.UsabilityFeedback;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IUsabilityFeedbackRepository extends JpaRepository<UsabilityFeedback, Long> {
}
