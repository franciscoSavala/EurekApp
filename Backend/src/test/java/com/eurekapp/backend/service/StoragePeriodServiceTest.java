package com.eurekapp.backend.service;

import com.eurekapp.backend.model.FoundObject;
import com.eurekapp.backend.model.OrganizationPolicy;
import com.eurekapp.backend.model.StorageStatus;
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
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StoragePeriodServiceTest {

    private static final ZoneId ZONA = ZoneId.of("America/Argentina/Cordoba");
    private static final LocalDateTime AHORA = LocalDateTime.of(2026, 11, 24, 12, 0);

    @Mock IOrganizationPolicyRepository policyRepository;

    StoragePeriodService service;

    @BeforeEach
    void setUp() {
        Clock reloj = Clock.fixed(AHORA.atZone(ZONA).toInstant(), ZONA);
        service = new StoragePeriodService(policyRepository, reloj);
    }

    private void plazo(long orgId, Integer dias) {
        when(policyRepository.findByOrganization_Id(orgId))
                .thenReturn(Optional.of(OrganizationPolicy.builder().maxStorageDays(dias).build()));
    }

    private FoundObject objeto(String orgId, LocalDateTime encontrado, Boolean devuelto) {
        return FoundObject.builder().uuid("o").organizationId(orgId)
                .foundDate(encontrado).wasReturned(devuelto).build();
    }

    @Test
    void sinPolitica_elObjetoNuncaVence() {
        when(policyRepository.findByOrganization_Id(anyLong())).thenReturn(Optional.empty());
        FoundObject fo = objeto("1", AHORA.minusDays(1000), false);

        Integer dias = service.getMaxStorageDays("1");

        assertThat(dias).isNull();
        assertThat(service.getStatus(fo, dias)).isNull();
        assertThat(service.getExpirationDate(fo, dias)).isNull();
        assertThat(service.isExpired(fo)).isFalse();
    }

    @Test
    void plazoVacio_elObjetoNuncaVence() {
        plazo(1L, null);
        FoundObject fo = objeto("1", AHORA.minusDays(1000), false);

        assertThat(service.getMaxStorageDays("1")).isNull();
        assertThat(service.isExpired(fo)).isFalse();
    }

    @Test
    void plazoCero_elObjetoNuncaVence() {
        plazo(1L, 0);
        FoundObject fo = objeto("1", AHORA.minusDays(1000), false);

        assertThat(service.getMaxStorageDays("1")).isNull();
        assertThat(service.isExpired(fo)).isFalse();
    }

    @Test
    void idDeOrganizacionInvalido_noTienePlazo() {
        assertThat(service.getMaxStorageDays(null)).isNull();
        assertThat(service.getMaxStorageDays("abc")).isNull();
    }

    @Test
    void objetoEnPlazo_estaEnPlazo() {
        FoundObject fo = objeto("1", AHORA.minusDays(10), false);

        assertThat(service.getStatus(fo, 30)).isEqualTo(StorageStatus.IN_TERM);
    }

    @Test
    void alOchentaPorCientoDelPlazo_estaPorVencer() {
        // 80 % de 30 días = 24 días: justo ahí ya está por vencer.
        FoundObject fo = objeto("1", AHORA.minusDays(24), false);

        assertThat(service.getStatus(fo, 30)).isEqualTo(StorageStatus.EXPIRING);
    }

    @Test
    void unMinutoAntesDelOchentaPorCiento_todaviaEstaEnPlazo() {
        FoundObject fo = objeto("1", AHORA.minusDays(24).plusMinutes(1), false);

        assertThat(service.getStatus(fo, 30)).isEqualTo(StorageStatus.IN_TERM);
    }

    @Test
    void justoEnElLimiteDelPlazo_estaVencido() {
        FoundObject fo = objeto("1", AHORA.minusDays(30), false);

        assertThat(service.getStatus(fo, 30)).isEqualTo(StorageStatus.EXPIRED);
    }

    @Test
    void pasadoElPlazo_estaVencido() {
        FoundObject fo = objeto("1", AHORA.minusDays(45), false);

        assertThat(service.getStatus(fo, 30)).isEqualTo(StorageStatus.EXPIRED);
    }

    @Test
    void objetoDevuelto_noTieneEstadoNiFechaDeVencimiento() {
        FoundObject fo = objeto("1", AHORA.minusDays(90), true);

        assertThat(service.getStatus(fo, 30)).isNull();
        assertThat(service.getExpirationDate(fo, 30)).isNull();
    }

    @Test
    void fechaDeVencimiento_esLaFechaDeHallazgoMasElPlazo() {
        LocalDateTime hallazgo = LocalDateTime.of(2026, 11, 1, 9, 30);
        FoundObject fo = objeto("1", hallazgo, false);

        assertThat(service.getExpirationDate(fo, 30)).isEqualTo(hallazgo.plusDays(30));
        assertThat(service.getExpirationDate(fo, null)).isNull();
    }

    @Test
    void isExpired_usaElPlazoDeLaOrganizacionDelObjeto() {
        plazo(1L, 30);
        assertThat(service.isExpired(objeto("1", AHORA.minusDays(31), false))).isTrue();
        assertThat(service.isExpired(objeto("1", AHORA.minusDays(5), false))).isFalse();
    }

    @Test
    void excludeExpired_sacaSoloLosVencidos_conservaElOrden_yLeeLaPoliticaUnaVezPorOrganizacion() {
        plazo(1L, 30);
        plazo(2L, 10);
        FoundObject a = objeto("1", AHORA.minusDays(5), false);    // en plazo
        FoundObject b = objeto("1", AHORA.minusDays(40), false);   // vencido
        FoundObject c = objeto("2", AHORA.minusDays(3), false);    // en plazo
        FoundObject d = objeto("2", AHORA.minusDays(11), false);   // vencido
        FoundObject e = objeto("1", AHORA.minusDays(29), false);   // por vencer

        List<FoundObject> result = service.excludeExpired(List.of(a, b, c, d, e));

        assertThat(result).containsExactly(a, c, e);
        verify(policyRepository, times(1)).findByOrganization_Id(1L);
        verify(policyRepository, times(1)).findByOrganization_Id(2L);
    }

    @Test
    void cambiarElPlazo_cambiaElResultadoParaElMismoObjeto() {
        FoundObject fo = objeto("1", AHORA.minusDays(20), false);

        assertThat(service.getStatus(fo, 60)).isEqualTo(StorageStatus.IN_TERM);
        assertThat(service.getStatus(fo, 22)).isEqualTo(StorageStatus.EXPIRING);
        assertThat(service.getStatus(fo, 15)).isEqualTo(StorageStatus.EXPIRED);
    }
}
