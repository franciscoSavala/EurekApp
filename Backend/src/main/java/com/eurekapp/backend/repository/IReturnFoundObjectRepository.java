package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.ReturnFoundObject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface IReturnFoundObjectRepository extends JpaRepository<ReturnFoundObject, Long> {
    @Query(value = "SELECT ret.id FROM return_found_objects ret", nativeQuery = true)
    List<Long> findAllId();
    ReturnFoundObject getReferenceByFoundObjectUUID(String foundObjectUUID);
    ReturnFoundObject findByFoundObjectUUID(String foundObjectUUID);

    // EU-374: la encuesta de atencion se resuelve por su token, nunca por el id de la devolucion.
    Optional<ReturnFoundObject> findByFeedbackToken(String feedbackToken);
    List<ReturnFoundObject> findByFoundObjectUUIDInAndDatetimeOfReturnBetween(
            List<String> uuids, LocalDateTime from, LocalDateTime to);

    /**
     * EU-348: devoluciones de un lote de objetos, para resolver sus fechas en UN solo viaje a la
     * base. La variante de arriba exige un rango de fechas, que en el listado del historial no
     * corresponde inventar: se quieren todas.
     */
    List<ReturnFoundObject> findByFoundObjectUUIDIn(List<String> uuids);

    /**
     * Devoluciones de un DNI dentro de la ventana deslizante (detección de fraude, EU-284). La
     * consulta queda acotada al DNI (indexable): la detección NO escanea todas las devoluciones,
     * solo las que comparten identidad con la que disparó el chequeo. Es cross-organización a
     * propósito (un mismo DNI puede recorrer varias orgs llevándose objetos).
     */
    @Query("SELECT r FROM ReturnFoundObject r WHERE r.DNI = :dni AND r.datetimeOfReturn >= :from")
    List<ReturnFoundObject> findByDniInWindow(@Param("dni") String dni, @Param("from") LocalDateTime from);
}