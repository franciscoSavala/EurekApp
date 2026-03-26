package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.OrganizationPolicyHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IOrganizationPolicyHistoryRepository extends JpaRepository<OrganizationPolicyHistory, Long> {
    List<OrganizationPolicyHistory> findByOrganizationIdOrderByChangedAtDesc(Long organizationId);
}
