package com.eurekapp.backend.service;

import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.repository.FoundObjectRepository;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.IUserRepository;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

@AllArgsConstructor
@Service
public class PlatformCountsService {

    private FoundObjectRepository foundObjectRepository;
    private IOrganizationRepository organizationRepository;
    private IUserRepository userRepository;

    public long countUsers() {
        return userRepository.count();
    }

    public long countUsers(Role role) {
        return userRepository.countByRole(role);
    }

    public long countOrganizations() {
        return organizationRepository.count();
    }

    public long countReturnedFoundObjects() {
        return foundObjectRepository.query(null, null, null, null, null, true, null).size();
    }

    public long countUnreturnedFoundObjects() {
        return foundObjectRepository.query(null, null, null, null, null, false, null).size();
    }
}
