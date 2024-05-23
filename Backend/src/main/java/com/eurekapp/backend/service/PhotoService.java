package com.eurekapp.backend.service;

import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.Image;
import com.eurekapp.backend.repository.ImageRepository;
import com.eurekapp.backend.service.client.S3Service;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.MethodNotAllowedException;

import java.io.*;
import java.util.List;
import java.util.UUID;

@Service
public class PhotoService {

    private final S3Service s3Service;
    private final ImageRepository repository;

    public PhotoService(S3Service s3Service, ImageRepository repository) {
        this.s3Service = s3Service;
        this.repository = repository;
    }


    public byte[] getImageFromTag(String tag) {
        throw new RuntimeException("Not implemented");
    }
}
