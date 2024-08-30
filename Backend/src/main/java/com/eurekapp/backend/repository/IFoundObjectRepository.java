package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.FoundObject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IFoundObjectRepository extends JpaRepository<FoundObject, Long> {
    @Query(value = "SELECT fo.id FROM found_objects fo", nativeQuery = true)
    List<Long> findAllId();
}