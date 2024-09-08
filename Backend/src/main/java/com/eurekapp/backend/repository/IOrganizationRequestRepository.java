package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.OrganizationRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IOrganizationRequestRepository extends JpaRepository<OrganizationRequest, Long> {
}
