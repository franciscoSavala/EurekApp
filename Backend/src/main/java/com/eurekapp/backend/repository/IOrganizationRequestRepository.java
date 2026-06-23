package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.OrganizationRequest;
import com.eurekapp.backend.model.OrganizationRequestStatus;
import com.eurekapp.backend.model.UserEurekapp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface IOrganizationRequestRepository extends JpaRepository<OrganizationRequest, Long> {
    List<OrganizationRequest> findByRequestingUserAndStatus(UserEurekapp requestingUser, OrganizationRequestStatus status);
    List<OrganizationRequest> findByRequestingUserOrderByCreatedAtDesc(UserEurekapp requestingUser);
    Optional<OrganizationRequest> findFirstByRequestingUserOrderByCreatedAtDesc(UserEurekapp requestingUser);
    Optional<OrganizationRequest> findFirstByOwnerEmailAndStatus(String ownerEmail, OrganizationRequestStatus status);
    long countByStatus(OrganizationRequestStatus status);
}
