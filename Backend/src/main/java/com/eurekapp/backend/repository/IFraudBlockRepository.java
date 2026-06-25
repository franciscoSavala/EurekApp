package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.FraudBlock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface IFraudBlockRepository extends JpaRepository<FraudBlock, Long> {

    boolean existsByTargetDniAndExpiresAtAfter(String targetDni, LocalDateTime now);

    boolean existsByTargetUser_IdAndExpiresAtAfter(Long targetUserId, LocalDateTime now);

    // Bloqueos creados por una alerta concreta: se usan al marcarla FALSA_ALARMA para levantarlos (EU-287).
    List<FraudBlock> findByFraudAlert_Id(Long fraudAlertId);

    // Bloqueo vigente (no expirado) más reciente para un DNI / usuario, con la alerta traída por JOIN
    // FETCH para poder leer su motivo al armar el mensaje humano de bloqueo (EU-288) sin lazy-loading.
    @Query("select b from FraudBlock b join fetch b.fraudAlert "
            + "where b.targetDni = :dni and b.expiresAt > :now order by b.expiresAt desc")
    List<FraudBlock> findActiveDniBlocks(@Param("dni") String dni, @Param("now") LocalDateTime now);

    @Query("select b from FraudBlock b join fetch b.fraudAlert "
            + "where b.targetUser.id = :userId and b.expiresAt > :now order by b.expiresAt desc")
    List<FraudBlock> findActiveUserBlocks(@Param("userId") Long userId, @Param("now") LocalDateTime now);
}
