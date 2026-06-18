package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.FraudBlock;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface IFraudBlockRepository extends JpaRepository<FraudBlock, Long> {

    boolean existsByTargetDniAndExpiresAtAfter(String targetDni, LocalDateTime now);

    boolean existsByTargetUser_IdAndExpiresAtAfter(Long targetUserId, LocalDateTime now);

    // Bloqueos creados por una alerta concreta: se usan al marcarla FALSA_ALARMA para levantarlos (EU-287).
    List<FraudBlock> findByFraudAlert_Id(Long fraudAlertId);
}
