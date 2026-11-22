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
    @JsonProperty("first_name")
    private String firstName;
    @JsonProperty("last_name")
    private String lastName;
    @JsonProperty("dni")
    private String DNI;
    @JsonProperty("phone_number")
    private String phoneNumber;
    @JsonProperty("found_object_uuid")
    private String foundObjectUUID;
    /** EU-440: confirmación del empleado de que verificó la identidad de quien retira. */
    private Boolean identityVerified;
    /** EU-440: confirmación del empleado de que pidió la evidencia adicional de propiedad. */
    private Boolean evidenceVerified;
    @JsonIgnore
    private Long organizationId;
    private MultipartFile image;
}

