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
public class ReturnFoundObjectCommand {
    private String username;
    private String DNI;
    private String phoneNumber;
    private String foundObjectUUID;
    private Long organizationId;
}

