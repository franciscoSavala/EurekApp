package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.UsabilityFeedback;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface IUsabilityFeedbackRepository extends JpaRepository<UsabilityFeedback, Long> {

    /* EU-367: el reporte lo ve el administrador de EurekApp y es consolidado, así que ya no se
     * recorta por la organización del autor. Ese recorte dejaba afuera al usuario final —que no
     * pertenece a ninguna organización— y hacía que sus respuestas no se vieran en ninguna pantalla. */
    List<UsabilityFeedback> findByCreatedAtBetween(LocalDateTime from, LocalDateTime to);
}
