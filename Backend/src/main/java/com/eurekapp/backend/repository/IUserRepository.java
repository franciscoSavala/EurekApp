package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.UserEurekapp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface IUserRepository extends JpaRepository<UserEurekapp, Long> {
    Optional<UserEurekapp> findByUsername(String username);
    Boolean existsByUsername(String username);
}
