package com.eurekapp.backend.service;

import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.model.OrganizationPolicy;
import com.eurekapp.backend.repository.IOrganizationPolicyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LostDateLimitServiceTest {

    private static final ZoneId ZONA = ZoneId.of("America/Argentina/Cordoba");
    private static final LocalDateTime AHORA = LocalDateTime.of(2026, 11, 24, 12, 0);

    @Mock IOrganizationPolicyRepository policyRepository;

    LostDateLimitService service;

    @BeforeEach
    void setUp() {
        Clock reloj = Clock.fixed(AHORA.atZone(ZONA).toInstant(), ZONA);
        service = new LostDateLimitService(policyRepository, reloj);
    }

    private void plazo(long orgId, Integer dias) {
        when(policyRepository.findByOrganization_Id(orgId))
                .thenReturn(Optional.of(OrganizationPolicy.builder().maxLostDateDays(dias).build()));
    }

    @Test
    void perdidaDeHace15DiasConPlazo30_pasa() {
        plazo(1L, 30);
        assertThatCode(() -> service.validateLostDate(1L, AHORA.minusDays(15))).doesNotThrowAnyException();
    }

    @Test
    void perdidaDeHaceExactamente30DiasConPlazo30_pasa() {
        plazo(1L, 30);
        assertThatCode(() -> service.validateLostDate(1L, AHORA.minusDays(30))).doesNotThrowAnyException();
    }

    @Test
    void perdidaDeHace31DiasConPlazo30_seRechazaConMensajeQueDiceElPlazo() {
        plazo(1L, 30);
        assertThatThrownBy(() -> service.validateLostDate(1L, AHORA.minusDays(31)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("30 días");
    }

    @Test
    void fechaFutura_seRechaza() {
        plazo(1L, 30);
        assertThatThrownBy(() -> service.validateLostDate(1L, AHORA.plusDays(1)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void sinOrganizacion_noAplicaElPlazoPeroLaFechaFuturaSeRechazaIgual() {
        assertThatCode(() -> service.validateLostDate((Long) null, AHORA.minusDays(1000))).doesNotThrowAnyException();
        assertThatThrownBy(() -> service.validateLostDate((Long) null, AHORA.plusDays(1)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void organizacionSinPlazoConfigurado_usaLos90DiasPorDefecto() {
        plazo(1L, null);
        assertThat(service.getMaxLostDateDays(1L)).isEqualTo(90);
        assertThatCode(() -> service.validateLostDate(1L, AHORA.minusDays(90))).doesNotThrowAnyException();
        assertThatThrownBy(() -> service.validateLostDate(1L, AHORA.minusDays(91)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void organizacionSinPolitica_usaLos90DiasPorDefecto() {
        when(policyRepository.findByOrganization_Id(2L)).thenReturn(Optional.empty());
        assertThat(service.getMaxLostDateDays(2L)).isEqualTo(90);
    }

    @Test
    void sinFechaDePerdida_noValidaNada() {
        assertThatCode(() -> service.validateLostDate(1L, null)).doesNotThrowAnyException();
    }

    @Test
    void organizacionComoTexto_seInterpretaYUnTextoInvalidoEquivaleASinOrganizacion() {
        plazo(1L, 30);
        assertThatThrownBy(() -> service.validateLostDate("1", AHORA.minusDays(31)))
                .isInstanceOf(BadRequestException.class);
        assertThatCode(() -> service.validateLostDate("abc", AHORA.minusDays(500))).doesNotThrowAnyException();
        assertThatCode(() -> service.validateLostDate("", AHORA.minusDays(500))).doesNotThrowAnyException();
    }

    @Test
    void valorConfigurado_negativoCeroONuloSeRechazan_yUnPositivoPasa() {
        assertThatThrownBy(() -> LostDateLimitService.validateConfiguredDays(-1))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> LostDateLimitService.validateConfiguredDays(0))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> LostDateLimitService.validateConfiguredDays(null))
                .isInstanceOf(BadRequestException.class);
        assertThatCode(() -> LostDateLimitService.validateConfiguredDays(1)).doesNotThrowAnyException();
    }
}
