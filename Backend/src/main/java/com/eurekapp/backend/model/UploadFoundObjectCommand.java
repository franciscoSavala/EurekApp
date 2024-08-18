package com.eurekapp.backend.model;

import lombok.Builder;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import org.springframework.web.multipart.MultipartFile;
import java.time.LocalDateTime;

@Getter
@Setter
@Data
@Builder
public class UploadFoundObjectCommand {
    private String description;
    private MultipartFile image;
    private LocalDateTime foundDate;
    private Long organizationId;
}
