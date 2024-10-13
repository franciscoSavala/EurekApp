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
    private String title;
    private MultipartFile image;
    private LocalDateTime foundDate;
    private String detailedDescription;
    private Long organizationId;
    private Double latitude;
    private Double longitude;
}
