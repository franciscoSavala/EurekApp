package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.FraudDetectionConfig;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IFraudDetectionConfigRepository extends JpaRepository<FraudDetectionConfig, Long> {
}
