package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface IOrganizationRepository extends JpaRepository<Organization, Long> {
    @Query(value = "SELECT org.id FROM organizations org", nativeQuery = true)
    List<Long> findAllId();
}
