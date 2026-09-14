package com.eurekapp.backend.dto;

import com.eurekapp.backend.dto.response.PublicOrganizationDto;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@NoArgsConstructor
@AllArgsConstructor
@Data
@Builder
public class FoundObjectDto {
    private String title;
    private String humanDescription;
    private String aiDescription;
    private String imageUrl;
    private Float score;
    private String id;
    /* EU-401: sin la información de contacto. Es el correo del dueño, que se rellena solo al
     * aprobar la organización; lo que necesita quien viene a retirar es el nombre y la dirección. */
    private PublicOrganizationDto organization;
    @JsonProperty("found_date")
    private LocalDateTime foundDate;
    /* EU-348: fecha en que el objeto se devolvió a su dueño. Null salvo en el listado de objetos
     * devueltos: no vive en Weaviate junto al resto del objeto, sino en MySQL (return_found_objects),
     * así que sólo se completa donde se cruzan las dos. */
    @JsonProperty("return_date")
    private LocalDateTime returnDate;
    private Float latitude;
    private Float longitude;
    private Float distance;
    private String category;
    private String finderEmail;
    private String finderFullName;
    private String finderRole;
}
