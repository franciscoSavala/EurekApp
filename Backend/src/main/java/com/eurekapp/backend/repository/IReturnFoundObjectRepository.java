package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.ReturnFoundObject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface IReturnFoundObjectRepository extends JpaRepository<ReturnFoundObject, Long> {
    @Query(value = "SELECT ret.id FROM return_found_objects ret", nativeQuery = true)
    List<Long> findAllId();
    ReturnFoundObject getReferenceByFoundObjectUUID(String foundObjectUUID);
    ReturnFoundObject findByFoundObjectUUID(String foundObjectUUID);
    List<ReturnFoundObject> findByFoundObjectUUIDInAndDatetimeOfReturnBetween(
            List<String> uuids, LocalDateTime from, LocalDateTime to);
}