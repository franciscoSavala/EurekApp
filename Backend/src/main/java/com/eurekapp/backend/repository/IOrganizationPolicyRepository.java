package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.OrganizationPolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface IOrganizationPolicyRepository extends JpaRepository<OrganizationPolicy, Long> {
    Optional<OrganizationPolicy> findByOrganization_Id(Long organizationId);
}
