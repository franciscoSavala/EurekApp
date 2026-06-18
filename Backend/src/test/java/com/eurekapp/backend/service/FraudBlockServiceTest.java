package com.eurekapp.backend.service;

import com.eurekapp.backend.model.FraudAlert;
import com.eurekapp.backend.model.FraudBlock;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IFraudBlockRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests del servicio de bloqueos de fraude (EU-286): creación de bloqueos a partir de una alerta
 * (1 fila por DNI + 1 por usuario sospechoso, con expiración = ahora + duración) y consultas de
 * vigencia delegadas al repositorio.
 */
@ExtendWith(MockitoExtension.class)
class FraudBlockServiceTest {

    @Mock IFraudBlockRepository blockRepository;

    FraudBlockService service;

    private UserEurekapp user(long id) {
        return UserEurekapp.builder().id(id).username("u" + id + "@x").role(Role.USER).build();
    }

    private FraudAlert alert(String dni, Set<UserEurekapp> suspects) {
        return FraudAlert.builder().id(1L).dni(dni).suspectUsers(suspects).build();
    }

    // Alerta con DNI + 2 sospechosos → 3 bloqueos: 1 sobre el DNI, 2 sobre usuarios, todos
    // expirando en blockedAt + duración.
    @Test
    void createBlocksForAlert_createsDniBlockAndOneBlockPerSuspect() {
        FraudBlockService svc = new FraudBlockService(blockRepository);
        Set<UserEurekapp> suspects = new LinkedHashSet<>();
        suspects.add(user(10L));
        suspects.add(user(20L));

        svc.createBlocksForAlert(alert("12345678", suspects), 7);

        ArgumentCaptor<FraudBlock> captor = ArgumentCaptor.forClass(FraudBlock.class);
        verify(blockRepository, org.mockito.Mockito.times(3)).save(captor.capture());
        List<FraudBlock> saved = captor.getAllValues();

        // 1 bloqueo sobre el DNI (sin usuario)
        assertThat(saved).filteredOn(b -> b.getTargetDni() != null)
                .hasSize(1)
                .allSatisfy(b -> {
                    assertThat(b.getTargetDni()).isEqualTo("12345678");
                    assertThat(b.getTargetUser()).isNull();
                });

        // 2 bloqueos sobre usuarios (sin DNI)
        assertThat(saved).filteredOn(b -> b.getTargetUser() != null)
                .hasSize(2)
                .allSatisfy(b -> assertThat(b.getTargetDni()).isNull())
                .extracting(b -> b.getTargetUser().getId())
                .containsExactlyInAnyOrder(10L, 20L);

        // expiresAt == blockedAt + 7 días en todas las filas
        assertThat(saved).allSatisfy(b ->
                assertThat(b.getExpiresAt()).isEqualTo(b.getBlockedAt().plusDays(7)));
    }

    // Alerta de Caso 1 (DNI sin usuarios sospechosos) → un único bloqueo sobre el DNI.
    @Test
    void createBlocksForAlert_case1Only_createsOnlyDniBlock() {
        FraudBlockService svc = new FraudBlockService(blockRepository);

        svc.createBlocksForAlert(alert("99999999", new LinkedHashSet<>()), 7);

        ArgumentCaptor<FraudBlock> captor = ArgumentCaptor.forClass(FraudBlock.class);
        verify(blockRepository).save(captor.capture());
        assertThat(captor.getValue().getTargetDni()).isEqualTo("99999999");
        assertThat(captor.getValue().getTargetUser()).isNull();
    }

    // liftBlocksForAlert (FALSA_ALARMA): borra todos los bloqueos de la alerta y devuelve SOLO los
    // usuarios que quedaron efectivamente desbloqueados. Un sospechoso que sigue bloqueado por otra
    // alerta vigente no se devuelve (no se le avisa que está libre porque no lo está).
    @Test
    void liftBlocksForAlert_deletesBlocksAndReturnsOnlyUsersNoLongerBlocked() {
        service = new FraudBlockService(blockRepository);
        UserEurekapp freed = user(10L);          // tras el borrado queda libre
        UserEurekapp stillBlocked = user(20L);   // sigue bloqueado por otra alerta
        Set<UserEurekapp> suspects = new LinkedHashSet<>();
        suspects.add(freed);
        suspects.add(stillBlocked);
        FraudAlert alert = alert("12345678", suspects);

        List<FraudBlock> blocks = List.of(
                FraudBlock.builder().id(1L).targetDni("12345678").fraudAlert(alert).build(),
                FraudBlock.builder().id(2L).targetUser(freed).fraudAlert(alert).build(),
                FraudBlock.builder().id(3L).targetUser(stillBlocked).fraudAlert(alert).build());
        when(blockRepository.findByFraudAlert_Id(1L)).thenReturn(blocks);
        when(blockRepository.existsByTargetUser_IdAndExpiresAtAfter(eq(10L), any(LocalDateTime.class)))
                .thenReturn(false);
        when(blockRepository.existsByTargetUser_IdAndExpiresAtAfter(eq(20L), any(LocalDateTime.class)))
                .thenReturn(true);

        List<UserEurekapp> unblocked = service.liftBlocksForAlert(alert);

        verify(blockRepository).deleteAll(blocks);
        assertThat(unblocked).extracting(UserEurekapp::getId).containsExactly(10L);
    }

    // isDniBlocked delega en el repositorio.
    @Test
    void isDniBlocked_delegatesToRepository() {
        service = new FraudBlockService(blockRepository);
        when(blockRepository.existsByTargetDniAndExpiresAtAfter(eq("12345678"), any(LocalDateTime.class)))
                .thenReturn(true);

        assertThat(service.isDniBlocked("12345678")).isTrue();
        assertThat(service.isDniBlocked("00000000")).isFalse();
        assertThat(service.isDniBlocked(null)).isFalse();   // null nunca consulta el repo
    }

    // isUserBlocked delega en el repositorio.
    @Test
    void isUserBlocked_delegatesToRepository() {
        service = new FraudBlockService(blockRepository);
        when(blockRepository.existsByTargetUser_IdAndExpiresAtAfter(eq(10L), any(LocalDateTime.class)))
                .thenReturn(true);

        assertThat(service.isUserBlocked(10L)).isTrue();
        assertThat(service.isUserBlocked(99L)).isFalse();
        assertThat(service.isUserBlocked(null)).isFalse();  // null nunca consulta el repo
    }
}
