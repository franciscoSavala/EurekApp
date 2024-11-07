package com.eurekapp.backend.model;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
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
    @JsonProperty("username")
    private String username;
    @JsonProperty("dni")
    private String DNI;
    @JsonProperty("phone_number")
    private String phoneNumber;
    @JsonProperty("found_object_uuid")
    private String foundObjectUUID;
    @JsonIgnore
    private Long organizationId;
    private MultipartFile image;
}

