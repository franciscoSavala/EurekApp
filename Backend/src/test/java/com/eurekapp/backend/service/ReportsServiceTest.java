package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.response.CategoryCountDto;
import com.eurekapp.backend.dto.response.ReportsResponseDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.repository.FoundObjectRepository;
import com.eurekapp.backend.repository.IReturnFoundObjectRepository;
import com.eurekapp.backend.repository.IUserRepository;
import com.eurekapp.backend.repository.LostObjectRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Reportes de uso de la organización: quién los ve, tiempos de recuperación y categorías más reportadas. */
class ReportsServiceTest {

    private static final LocalDate DESDE = LocalDate.of(2026, 3, 1);
    private static final LocalDate HASTA = LocalDate.of(2026, 3, 31);

    private FoundObjectRepository foundObjectRepository;
    private LostObjectRepository lostObjectRepository;
    private IReturnFoundObjectRepository returnRepository;
    private ReportsService service;
    private UserEurekapp dueno;

    @BeforeEach
    void setUp() {
        foundObjectRepository = mock(FoundObjectRepository.class);
        lostObjectRepository = mock(LostObjectRepository.class);
        returnRepository = mock(IReturnFoundObjectRepository.class);
        IUserRepository userRepository = mock(IUserRepository.class);
        service = new ReportsService(foundObjectRepository, lostObjectRepository, returnRepository, userRepository);
        Organization org = Organization.builder().id(1L).name("UTN").build();
        dueno = UserEurekapp.builder().id(1L).role(Role.ORGANIZATION_OWNER).organization(org).build();
        when(lostObjectRepository.query(any(), any(), anyString(), any(), any(), anyInt(), any())).thenReturn(List.of());
    }

    private void hallados(FoundObject... objetos) {
        when(foundObjectRepository.query(any(), anyString(), any(), any(), any(), any(), any(), anyInt(), any()))
                .thenReturn(List.of(objetos));
    }

    private void devueltos(ReturnFoundObject... devoluciones) {
        when(returnRepository.findByFoundObjectUUIDInAndDatetimeOfReturnBetween(anyList(), any(), any()))
                .thenReturn(List.of(devoluciones));
    }

    private static FoundObject hallado(String uuid, LocalDateTime cuando, String categoria) {
        return FoundObject.builder().uuid(uuid).foundDate(cuando).category(categoria).build();
    }

    private static ReturnFoundObject devolucion(String uuid, LocalDateTime cuando) {
        return ReturnFoundObject.builder().foundObjectUUID(uuid).datetimeOfReturn(cuando).build();
    }

    @Test
    void soloElResponsableDeLaOrganizacionPuedeVerLosReportes() {
        UserEurekapp empleado = UserEurekapp.builder().role(Role.ORGANIZATION_EMPLOYEE).organization(dueno.getOrganization()).build();

        assertThatThrownBy(() -> service.getReports(empleado, DESDE, HASTA, "DAY"))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void tiempoDeRecuperacion_promedioMinimoYMaximoEnHoras() {
        LocalDateTime hallazgo = LocalDateTime.of(2026, 3, 10, 8, 0);
        hallados(hallado("a", hallazgo, "Billeteras"), hallado("b", hallazgo, "Billeteras"));
        devueltos(devolucion("a", hallazgo.plusHours(2)), devolucion("b", hallazgo.plusHours(4)));

        ReportsResponseDto r = service.getReports(dueno, DESDE, HASTA, "DAY");

        assertThat(r.getReturnedObjects()).isEqualTo(2L);
        assertThat(r.getAvgRecoveryHours()).isEqualTo(3.0);
        assertThat(r.getMinRecoveryHours()).isEqualTo(2.0);
        assertThat(r.getMaxRecoveryHours()).isEqualTo(4.0);
    }

    @Test
    void unaDevolucionAnteriorAlHallazgo_noCuentaEnElTiempoDeRecuperacion() {
        LocalDateTime hallazgo = LocalDateTime.of(2026, 3, 10, 8, 0);
        hallados(hallado("a", hallazgo, "Llaves"));
        devueltos(devolucion("a", hallazgo.minusHours(1)));

        ReportsResponseDto r = service.getReports(dueno, DESDE, HASTA, "DAY");

        assertThat(r.getReturnedObjects()).isEqualTo(1L);
        assertThat(r.getAvgRecoveryHours()).isNull();
        assertThat(r.getMinRecoveryHours()).isNull();
        assertThat(r.getMaxRecoveryHours()).isNull();
    }

    @Test
    void categoriasMasReportadas_deMayorAMenorYSinLasVacias() {
        LocalDateTime d = LocalDateTime.of(2026, 3, 5, 10, 0);
        hallados(hallado("1", d, "Llaves"), hallado("2", d, "Billeteras"), hallado("3", d, "Billeteras"),
                hallado("4", d, "Billeteras"), hallado("5", d, "Llaves"), hallado("6", d, "Mochilas"),
                hallado("7", d, " "), hallado("8", d, null));
        devueltos();

        List<CategoryCountDto> top = service.getReports(dueno, DESDE, HASTA, "MONTH").getTopCategories();

        assertThat(top).extracting(CategoryCountDto::category).containsExactly("Billeteras", "Llaves", "Mochilas");
        assertThat(top).extracting(CategoryCountDto::count).containsExactly(3L, 2L, 1L);
    }
}
