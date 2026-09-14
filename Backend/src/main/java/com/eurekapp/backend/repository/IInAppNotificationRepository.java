package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.InAppNotification;
import com.eurekapp.backend.model.UserEurekapp;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface IInAppNotificationRepository extends JpaRepository<InAppNotification, Long> {

    List<InAppNotification> findByUserOrderByCreatedAtDesc(UserEurekapp user);

    long countByUserAndReadFalse(UserEurekapp user);

    // EU-398: las que quedan por leer de ese usuario. Entrar a la sección las marca a todas de una:
    // hasta ahora lo único que dejaba constancia era tocarlas de a una, así que el numerito del menú
    // se apagaba en la pantalla y el refresco siguiente lo volvía a encender.
    List<InAppNotification> findByUserAndReadFalse(UserEurekapp user);

    Optional<InAppNotification> findByIdAndUser(Long id, UserEurekapp user);

    Optional<InAppNotification> findByRelatedRequestId(Long relatedRequestId);
}
