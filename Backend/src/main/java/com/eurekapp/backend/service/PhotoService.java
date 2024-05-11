package com.eurekapp.backend.service;

import com.eurekapp.backend.model.WorkItem;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@Service
public class PhotoService {
    @Autowired
    private RekognitionService service;

    public List<WorkItem> getTagsFromImage(MultipartFile file){
        try {
            byte[] bytes = file.getBytes();
            return service.detectLabel(bytes, "some_key");
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }
}
