package com.eurekapp.backend.service;

import com.eurekapp.backend.model.FraudAlert;
import com.eurekapp.backend.model.FraudBlock;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IFraudBlockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Gestión de bloqueos por sospecha de fraude (EU-286). Centraliza la creación de los {@link FraudBlock}
 * cuando salta una alerta y las consultas de "¿está bloqueado?" que usan retiro y alta.
 *
 * La sanción dura {@code blockDurationDays} días (parámetro independiente del período de detección T),
 * contados desde el momento en que se crea el bloqueo.
 */
@RequiredArgsConstructor
@Service
public class FraudBlockService {

    private final IFraudBlockRepository blockRepository;

    /**
     * Crea los bloqueos derivados de una alerta de fraude ya persistida:
     *  - una fila para el DNI de quien retira (si la alerta tiene DNI);
     *  - una fila por cada usuario sospechoso (finder, retirador y/o empleado, según los casos).
     * Todas expiran en {@code now + blockDurationDays}.
     */
    public void createBlocksForAlert(FraudAlert alert, int blockDurationDays) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiresAt = now.plusDays(blockDurationDays);

        if (alert.getDni() != null) {
            blockRepository.save(FraudBlock.builder()
                    .targetDni(alert.getDni())
                    .targetUser(null)
                    .fraudAlert(alert)
                    .blockedAt(now)
                    .expiresAt(expiresAt)
                    .build());
        }

        for (UserEurekapp suspect : alert.getSuspectUsers()) {
            if (suspect != null && suspect.getId() != null) {
                blockRepository.save(FraudBlock.builder()
                        .targetDni(null)
                        .targetUser(suspect)
                        .fraudAlert(alert)
                        .blockedAt(now)
                        .expiresAt(expiresAt)
                        .build());
            }
        }
    }

    /**
     * Levanta (borra) los bloqueos asociados a una alerta marcada como falsa alarma (EU-287) y devuelve
     * los usuarios registrados que quedaron efectivamente desbloqueados, es decir, los que tras el borrado
     * ya no tienen ningún otro bloqueo vigente. Los bloqueos por DNI sin cuenta también se borran, pero no
     * se devuelven (no hay a quién notificar).
     */
    public List<UserEurekapp> liftBlocksForAlert(FraudAlert alert) {
        List<FraudBlock> blocks = blockRepository.findByFraudAlert_Id(alert.getId());
        blockRepository.deleteAll(blocks);
        return alert.getSuspectUsers().stream()
                .filter(u -> u != null && u.getId() != null)
                .filter(u -> !isUserBlocked(u.getId()))
                .collect(Collectors.toList());
    }

    /** True si existe un bloqueo vigente (no expirado) para ese DNI. */
    public boolean isDniBlocked(String dni) {
        return dni != null && blockRepository.existsByTargetDniAndExpiresAtAfter(dni, LocalDateTime.now());
    }

    /** True si existe un bloqueo vigente (no expirado) para ese usuario registrado. */
    public boolean isUserBlocked(Long userId) {
        return userId != null && blockRepository.existsByTargetUser_IdAndExpiresAtAfter(userId, LocalDateTime.now());
    }
}
