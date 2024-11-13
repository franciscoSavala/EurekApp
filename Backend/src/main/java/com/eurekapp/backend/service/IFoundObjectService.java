package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.FoundObjectDto;
import com.eurekapp.backend.dto.command.FoundObjectDetailCommand;
import com.eurekapp.backend.dto.response.FoundObjectUploadedResponseDto;
import com.eurekapp.backend.dto.FoundObjectsListDto;
import com.eurekapp.backend.model.SimilarObjectsCommand;
import com.eurekapp.backend.model.UploadFoundObjectCommand;
import com.eurekapp.backend.model.UserEurekapp;

public interface IFoundObjectService {
    FoundObjectUploadedResponseDto uploadFoundObject(UploadFoundObjectCommand uploadFoundObjectCommand);
    FoundObjectsListDto getFoundObjectByTextDescription(SimilarObjectsCommand similarObjectsCommand);
    FoundObjectsListDto getAllUnreturnedFoundObjectsByOrganization(SimilarObjectsCommand command);

    FoundObjectsListDto getAllReturnedFoundObjectsByOrganization(UserEurekapp user);

    FoundObjectDto getFoundObjectDetail(FoundObjectDetailCommand command);
}
