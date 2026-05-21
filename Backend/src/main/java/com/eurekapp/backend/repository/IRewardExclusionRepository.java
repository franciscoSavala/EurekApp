package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.RewardExclusion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IRewardExclusionRepository extends JpaRepository<RewardExclusion, Long> {

    List<RewardExclusion> findByOrganizationId(String organizationId);

    boolean existsByFoundObjectUUID(String foundObjectUUID);
}
