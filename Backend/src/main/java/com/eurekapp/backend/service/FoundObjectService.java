package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.ImageUploadedResponseDto;
import com.eurekapp.backend.dto.TopSimilarFoundObjectsDto;
import org.springframework.web.multipart.MultipartFile;

public interface FoundObjectService {
    ImageUploadedResponseDto uploadFoundObject(MultipartFile file, String description, Long organizationId);
    TopSimilarFoundObjectsDto getFoundObjectByTextDescription(String query, Long organizationId);
}
