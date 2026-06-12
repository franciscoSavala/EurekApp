package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.FraudBlock;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;

public interface IFraudBlockRepository extends JpaRepository<FraudBlock, Long> {

    boolean existsByTargetDniAndExpiresAtAfter(String targetDni, LocalDateTime now);

    boolean existsByTargetUser_IdAndExpiresAtAfter(Long targetUserId, LocalDateTime now);
}
