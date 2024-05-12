package com.eurekapp.backend.service;

import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.Image;
import com.eurekapp.backend.model.WorkItem;
import com.eurekapp.backend.repository.ImageRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

@Service
public class PhotoService {

    private final S3Service s3Service;
    private final RekognitionService service;
    private final ImageRepository repository;

    public PhotoService(S3Service s3Service, RekognitionService service, ImageRepository repository) {
        this.s3Service = s3Service;
        this.service = service;
        this.repository = repository;
    }

    public Image getTagsFromImage(MultipartFile file){
        try {
            byte[] bytes = file.getBytes();
            String key = UUID.randomUUID().toString();
            s3Service.putObject(bytes, key);
            List<WorkItem> workItems = service.detectLabel(bytes);
            Image image = Image.builder()
                    .key(key)
                    .workItems(workItems)
                    .build();
            repository.save(image);

            return image;

        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    public byte[] getImageFromTag(String tag) throws IOException {
        List<Image> allImages = repository.findAll();
        Image firstImage = allImages.stream()
                .filter(i -> i.getWorkItems().stream()
                        .anyMatch(workItem -> workItem.getName().equals(tag)))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("No hay un objeto especificado con los el tag especificado"));
        byte[] imageBytes = s3Service.getObjectBytes(firstImage.getKey());
        return imageBytes;
    }
}
