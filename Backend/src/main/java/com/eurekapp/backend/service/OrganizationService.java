package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.OrganizationDto;
import com.eurekapp.backend.dto.OrganizationListResponseDto;
import com.eurekapp.backend.dto.SignUpOrganizationCommand;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.OrganizationRequest;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.IOrganizationRequestRepository;
import lombok.AllArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@AllArgsConstructor
@Service
public class OrganizationService {

    private IOrganizationRepository organizationRepository;
    private IOrganizationRequestRepository requestRepository;

    public OrganizationListResponseDto getAllOrganizations() {
        List<Organization> organizations = organizationRepository.findAll();
        List<OrganizationDto> organizationDtos = organizations.stream()
                .map(this::organizationToDto)
                .toList();
        return new OrganizationListResponseDto(organizationDtos);
    }

    public OrganizationDto organizationToDto(Organization organization) {
        return OrganizationDto.builder()
                .id(organization.getId())
                .name(organization.getName())
                .contactData(organization.getContactData())
                .build();
    }

    public void signUpOrganization(SignUpOrganizationCommand signUpOrganization) {
        OrganizationRequest organizationRequest = OrganizationRequest.builder()
                .contactEmail(signUpOrganization.getContactEmail())
                .requestData(signUpOrganization.getRequestData())
                .build();
        requestRepository.save(organizationRequest);
    }
}
