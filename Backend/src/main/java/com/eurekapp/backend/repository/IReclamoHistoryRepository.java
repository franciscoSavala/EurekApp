package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.ReclamoHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IReclamoHistoryRepository extends JpaRepository<ReclamoHistory, Long> {
    List<ReclamoHistory> findByReclamo_IdOrderByChangedAtAsc(Long reclamoId);
}
