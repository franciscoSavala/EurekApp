package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.ImageUploadedResponseDto;
import com.eurekapp.backend.dto.TopSimilarFoundObjectsDto;
import com.eurekapp.backend.model.SimilarObjectsCommand;
import com.eurekapp.backend.model.UploadFoundObjectCommand;

public interface IPhotoService {
    ImageUploadedResponseDto uploadFoundObject(UploadFoundObjectCommand uploadFoundObjectCommand);
    TopSimilarFoundObjectsDto getFoundObjectByTextDescription(SimilarObjectsCommand similarObjectsCommand);
}
