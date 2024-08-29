package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.ImageUploadedResponseDto;
import com.eurekapp.backend.dto.TopSimilarFoundObjectsDto;
import com.eurekapp.backend.model.SimilarObjectsCommand;
import com.eurekapp.backend.model.UploadFoundObjectCommand;
import org.springframework.web.multipart.MultipartFile;
import java.time.LocalDateTime;

public interface FoundObjectService {
    ImageUploadedResponseDto uploadFoundObject(UploadFoundObjectCommand uploadFoundObjectCommand);
    TopSimilarFoundObjectsDto getFoundObjectByTextDescription(SimilarObjectsCommand similarObjectsCommand);
}
