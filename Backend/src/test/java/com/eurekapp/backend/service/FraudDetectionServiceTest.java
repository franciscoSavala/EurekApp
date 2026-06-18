package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.response.FraudAlertDto;
import com.eurekapp.backend.model.FoundObject;
import com.eurekapp.backend.model.FraudAlert;
import com.eurekapp.backend.model.FraudAlertStatus;
import com.eurekapp.backend.model.FraudCaseType;
import com.eurekapp.backend.model.FraudDetectionConfig;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.ReturnFoundObject;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.FoundObjectRepository;
import com.eurekapp.backend.repository.IFraudAlertRepository;
import com.eurekapp.backend.repository.IReturnFoundObjectRepository;
import com.eurekapp.backend.repository.IUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests de detección de fraude sobre devoluciones (EU-284): las 3 reglas con ventana deslizante,
 * umbral N global, conteo acotado al DNI, una sola alerta por DNI con todos los casos, y dedup.
 * Se conservan los tests de mapeo entidad → DTO del refactor de FraudAlert (EU-282).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FraudDetectionServiceTest {

    @Mock IFraudAlertRepository alertRepository;
    @Mock IUserRepository userRepository;
    @Mock FoundObjectRepository foundObjectRepository;
    @Mock IReturnFoundObjectRepository returnFoundObjectRepository;
    @Mock FraudDetectionConfigService fraudDetectionConfigService;
    @Mock FraudBlockService fraudBlockService;

    FraudDetectionService service;

    @BeforeEach
    void setUp() {
        service = new FraudDetectionService(
                alertRepository, userRepository, foundObjectRepository,
                returnFoundObjectRepository, fraudDetectionConfigService, fraudBlockService);
        // Por defecto: sin alerta previa (dedup no bloquea).
        when(alertRepository.existsByDedupKeyAndCreatedAtAfter(anyString(), any())).thenReturn(false);
    }

    // ---------- helpers ----------

    private UserEurekapp user(long id, String email, String first, String last) {
        return UserEurekapp.builder()
                .id(id).username(email).firstName(first).lastName(last)
                .role(Role.USER).build();
    }

    private UserEurekapp owner(Organization org) {
        return UserEurekapp.builder()
                .id(100L).username("owner@test.com").firstName("Own").lastName("Er")
                .role(Role.ORGANIZATION_OWNER).organization(org).build();
    }

    private ReturnFoundObject ret(String uuid, String dni, UserEurekapp taker, UserEurekapp employee) {
        return ReturnFoundObject.builder()
                .foundObjectUUID(uuid)
                .DNI(dni)
                .userEurekapp(taker)
                .returnedByEmployee(employee)
                .datetimeOfReturn(LocalDateTime.now())
                .build();
    }

    private void configWith(int threshold, int windowDays) {
        when(fraudDetectionConfigService.loadOrCreateDefault()).thenReturn(
                FraudDetectionConfig.builder().id(1L)
                        .fraudThreshold(threshold).fraudWindowDays(windowDays)
                        .blockDurationDays(7).build());
    }

    // Mapea cada UUID a su finder (puede ser null) para que resolveFinder lo resuelva vía Weaviate.
    private void stubFinders(Map<String, UserEurekapp> findersByUuid) {
        when(foundObjectRepository.getByUuid(anyString())).thenAnswer(inv -> {
            String uuid = inv.getArgument(0);
            UserEurekapp finder = findersByUuid.get(uuid);
            return FoundObject.builder().uuid(uuid).objectFinderUser(finder).organizationId("1").build();
        });
    }

    private FraudAlert captureSavedAlert() {
        ArgumentCaptor<FraudAlert> captor = ArgumentCaptor.forClass(FraudAlert.class);
        verify(alertRepository).save(captor.capture());
        return captor.getValue();
    }

    // ---------- Caso 1: DNI ----------

    @Test
    void case1_sameDni_reachesThreshold_createsAlertBlockingDni() {
        configWith(5, 1);
        String dni = "11111111";
        // 5 devoluciones del mismo DNI, finder nulo y empleados distintos: solo dispara Caso 1.
        Map<String, UserEurekapp> finders = new HashMap<>();
        List<ReturnFoundObject> returns = List.of(
                ret("u1", dni, null, user(1, "e1@x", "E", "1")),
                ret("u2", dni, null, user(2, "e2@x", "E", "2")),
                ret("u3", dni, null, user(3, "e3@x", "E", "3")),
                ret("u4", dni, null, user(4, "e4@x", "E", "4")),
                ret("u5", dni, null, user(5, "e5@x", "E", "5")));
        stubFinders(finders); // todos sin finder
        when(returnFoundObjectRepository.findByDniInWindow(eq(dni), any())).thenReturn(returns);

        service.detectFraudForReturn(returns.get(4));

        FraudAlert alert = captureSavedAlert();
        assertThat(alert.getOrganizationId()).isNull();           // alerta global / ADMIN
        assertThat(alert.getDni()).isEqualTo(dni);
        assertThat(alert.getReason()).isEqualTo("CASE_1");
        assertThat(alert.getStatus()).isEqualTo(FraudAlertStatus.PENDING);
        assertThat(alert.getSuspectUsers()).isEmpty();            // Caso 1 solo bloquea el DNI
        assertThat(alert.getReturnedByEmployee()).isNull();
        assertThat(alert.getCaseMatches()).hasSize(1);
        assertThat(alert.getCaseMatches().get(0).getCaseType()).isEqualTo(FraudCaseType.CASE_1);
        assertThat(alert.getCaseMatches().get(0).getMatchedCount()).isEqualTo(5);
        assertThat(alert.getDedupKey()).isEqualTo("dni:" + dni);
    }

    @Test
    void detection_triggers_createsBlocksWithConfiguredDuration() {
        configWith(5, 1);   // blockDurationDays = 7 (ver helper)
        String dni = "77777777";
        List<ReturnFoundObject> returns = List.of(
                ret("u1", dni, null, user(1, "e1@x", "E", "1")),
                ret("u2", dni, null, user(2, "e2@x", "E", "2")),
                ret("u3", dni, null, user(3, "e3@x", "E", "3")),
                ret("u4", dni, null, user(4, "e4@x", "E", "4")),
                ret("u5", dni, null, user(5, "e5@x", "E", "5")));
        stubFinders(new HashMap<>());
        when(returnFoundObjectRepository.findByDniInWindow(eq(dni), any())).thenReturn(returns);

        service.detectFraudForReturn(returns.get(4));

        // La detección, al disparar, crea los bloqueos con la duración tomada de la config (7 días).
        verify(fraudBlockService).createBlocksForAlert(any(FraudAlert.class), eq(7));
    }

    @Test
    void belowThreshold_doesNotCreateAlert() {
        configWith(5, 1);
        String dni = "22222222";
        List<ReturnFoundObject> returns = List.of(
                ret("u1", dni, null, user(1, "e1@x", "E", "1")),
                ret("u2", dni, null, user(2, "e2@x", "E", "2")),
                ret("u3", dni, null, user(3, "e3@x", "E", "3")),
                ret("u4", dni, null, user(4, "e4@x", "E", "4")));
        when(returnFoundObjectRepository.findByDniInWindow(eq(dni), any())).thenReturn(returns);

        service.detectFraudForReturn(returns.get(3));

        verify(alertRepository, never()).save(any());
    }

    // ---------- Caso 2: (finder, DNI) — implica Caso 1 ----------

    @Test
    void case2_sameFinderAndDni_createsAlertWithCase1AndCase2() {
        configWith(3, 1);
        String dni = "33333333";
        UserEurekapp finder = user(10, "finder@x", "Fin", "Der");
        UserEurekapp taker = user(20, "taker@x", "Ta", "Ker");
        // Mismo finder en las 3, empleados distintos (Caso 3 no dispara), un retirador registrado.
        List<ReturnFoundObject> returns = List.of(
                ret("u1", dni, taker, user(1, "e1@x", "E", "1")),
                ret("u2", dni, null, user(2, "e2@x", "E", "2")),
                ret("u3", dni, null, user(3, "e3@x", "E", "3")));
        Map<String, UserEurekapp> finders = new HashMap<>();
        finders.put("u1", finder);
        finders.put("u2", finder);
        finders.put("u3", finder);
        stubFinders(finders);
        when(returnFoundObjectRepository.findByDniInWindow(eq(dni), any())).thenReturn(returns);

        service.detectFraudForReturn(returns.get(2));

        FraudAlert alert = captureSavedAlert();
        assertThat(alert.getReason()).isEqualTo("CASE_1,CASE_2");
        assertThat(alert.getDni()).isEqualTo(dni);
        assertThat(alert.getSuspectUsers()).extracting(UserEurekapp::getUsername)
                .containsExactlyInAnyOrder("finder@x", "taker@x");   // finder + retirador
        assertThat(alert.getCaseMatches()).extracting("caseType")
                .containsExactlyInAnyOrder(FraudCaseType.CASE_1, FraudCaseType.CASE_2);
    }

    // ---------- Caso 3: (empleado, DNI) — implica Caso 1 ----------

    @Test
    void case3_sameEmployeeAndDni_createsAlertWithCase1AndCase3() {
        configWith(3, 1);
        String dni = "44444444";
        UserEurekapp employee = user(30, "emp@x", "Emp", "Loyee");
        // Mismo empleado en las 3, finders distintos (Caso 2 no dispara), sin retirador.
        List<ReturnFoundObject> returns = List.of(
                ret("u1", dni, null, employee),
                ret("u2", dni, null, employee),
                ret("u3", dni, null, employee));
        Map<String, UserEurekapp> finders = new HashMap<>();
        finders.put("u1", user(11, "f1@x", "F", "1"));
        finders.put("u2", user(12, "f2@x", "F", "2"));
        finders.put("u3", user(13, "f3@x", "F", "3"));
        stubFinders(finders);
        when(returnFoundObjectRepository.findByDniInWindow(eq(dni), any())).thenReturn(returns);

        service.detectFraudForReturn(returns.get(2));

        FraudAlert alert = captureSavedAlert();
        assertThat(alert.getReason()).isEqualTo("CASE_1,CASE_3");
        assertThat(alert.getReturnedByEmployee()).isNotNull();
        assertThat(alert.getReturnedByEmployee().getUsername()).isEqualTo("emp@x");
        assertThat(alert.getSuspectUsers()).extracting(UserEurekapp::getUsername).contains("emp@x");
        assertThat(alert.getCaseMatches()).extracting("caseType")
                .containsExactlyInAnyOrder(FraudCaseType.CASE_1, FraudCaseType.CASE_3);
    }

    // ---------- Varios casos a la vez → una sola alerta ----------

    @Test
    void multipleCases_sameDni_createSingleAlertWithAllCases() {
        configWith(3, 1);
        String dni = "55555555";
        UserEurekapp finder = user(40, "finder@x", "Fin", "Der");
        UserEurekapp employee = user(50, "emp@x", "Emp", "Loyee");
        // Mismo finder Y mismo empleado en las 3 → disparan Caso 1, Caso 2 y Caso 3 juntos.
        List<ReturnFoundObject> returns = List.of(
                ret("u1", dni, null, employee),
                ret("u2", dni, null, employee),
                ret("u3", dni, null, employee));
        Map<String, UserEurekapp> finders = new HashMap<>();
        finders.put("u1", finder);
        finders.put("u2", finder);
        finders.put("u3", finder);
        stubFinders(finders);
        when(returnFoundObjectRepository.findByDniInWindow(eq(dni), any())).thenReturn(returns);

        service.detectFraudForReturn(returns.get(2));

        FraudAlert alert = captureSavedAlert();
        assertThat(alert.getReason()).isEqualTo("CASE_1,CASE_2,CASE_3");
        assertThat(alert.getCaseMatches()).extracting("caseType")
                .containsExactlyInAnyOrder(FraudCaseType.CASE_1, FraudCaseType.CASE_2, FraudCaseType.CASE_3);
        assertThat(alert.getSuspectUsers()).extracting(UserEurekapp::getUsername)
                .containsExactlyInAnyOrder("finder@x", "emp@x");
    }

    // ---------- Dedup ----------

    @Test
    void dedup_existingAlertForDniInWindow_doesNotCreateAnother() {
        configWith(3, 1);
        String dni = "66666666";
        List<ReturnFoundObject> returns = List.of(
                ret("u1", dni, null, user(1, "e1@x", "E", "1")),
                ret("u2", dni, null, user(2, "e2@x", "E", "2")),
                ret("u3", dni, null, user(3, "e3@x", "E", "3")));
        stubFinders(new HashMap<>());
        when(returnFoundObjectRepository.findByDniInWindow(eq(dni), any())).thenReturn(returns);
        // Ya existe una alerta para este DNI dentro de la ventana.
        when(alertRepository.existsByDedupKeyAndCreatedAtAfter(eq("dni:" + dni), any())).thenReturn(true);

        service.detectFraudForReturn(returns.get(2));

        verify(alertRepository, never()).save(any());
    }

    // ---------- Mapeo entidad → DTO (EU-282) ----------

    @Test
    void getAlerts_maps_dni_suspectUsers_and_employee() {
        Organization org = Organization.builder().id(1L).name("Org").build();
        UserEurekapp suspect = user(7L, "suspect@test.com", "Sus", "Pect");
        UserEurekapp employee = user(5L, "emp@test.com", "Emp", "Loyee");

        FraudAlert alert = FraudAlert.builder()
                .id(1L)
                .organizationId("1")
                .dni("12345678")
                .suspectUsers(new LinkedHashSet<>(Set.of(suspect)))
                .returnedByEmployee(employee)
                .reason("CASE_1")
                .details("detalle")
                .status(FraudAlertStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .build();

        when(alertRepository.findByOrganizationIdOrderByCreatedAtDesc("1"))
                .thenReturn(List.of(alert));

        List<FraudAlertDto> dtos = service.getAlerts(owner(org));

        assertThat(dtos).hasSize(1);
        FraudAlertDto dto = dtos.get(0);
        assertThat(dto.getDni()).isEqualTo("12345678");
        assertThat(dto.getSuspectUsers()).hasSize(1);
        assertThat(dto.getSuspectUsers().get(0).getEmail()).isEqualTo("suspect@test.com");
        assertThat(dto.getSuspectUsers().get(0).getFullName()).isEqualTo("Sus Pect");
        assertThat(dto.getReturnedByEmployeeEmail()).isEqualTo("emp@test.com");
        assertThat(dto.getReturnedByEmployeeFullName()).isEqualTo("Emp Loyee");
    }

    @Test
    void getAlerts_supports_multiple_suspect_users() {
        Organization org = Organization.builder().id(1L).name("Org").build();
        UserEurekapp finder = user(7L, "finder@test.com", "Fin", "Der");
        UserEurekapp retriever = user(8L, "retriever@test.com", "Re", "Triever");

        Set<UserEurekapp> suspects = new LinkedHashSet<>();
        suspects.add(finder);
        suspects.add(retriever);

        FraudAlert alert = FraudAlert.builder()
                .id(2L)
                .organizationId("1")
                .dni("30111222")
                .suspectUsers(suspects)
                .reason("CASE_2")
                .status(FraudAlertStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .build();

        when(alertRepository.findByOrganizationIdOrderByCreatedAtDesc("1"))
                .thenReturn(List.of(alert));

        List<FraudAlertDto> dtos = service.getAlerts(owner(org));

        assertThat(dtos).hasSize(1);
        assertThat(dtos.get(0).getSuspectUsers())
                .extracting("email")
                .containsExactlyInAnyOrder("finder@test.com", "retriever@test.com");
        assertThat(dtos.get(0).getReturnedByEmployeeEmail()).isNull();
    }
}
