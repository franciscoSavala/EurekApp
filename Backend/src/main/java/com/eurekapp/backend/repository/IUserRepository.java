package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface IUserRepository extends JpaRepository<UserEurekapp, Long> {
    Optional<UserEurekapp> findByUsername(String username);
    UserEurekapp getByUsername(String username);
    Boolean existsByUsername(String username);
    List<UserEurekapp> findByOrganizationAndRole(Organization organization, Role role);

}
