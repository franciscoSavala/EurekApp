package com.eurekapp.backend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LostObjectResponseDto {
    private String uuid;
    private String description;
    private LocalDateTime lostDate;
    private String organizationId;
    // Nombre de la organización donde se perdió el objeto. El id solo no le dice nada al usuario.
    // null si la búsqueda se guardó sin organización (se perdió en la vía pública).
    private String organizationName;
    // Categoría dura deducida por la IA al guardar la búsqueda. Se le muestra al usuario para que
    // pueda darse cuenta de que se infirió mal (el filtro es duro: una categoría errada esconde el
    // objeto en silencio). null/vacía si ninguna señal alcanzó y la búsqueda quedó sin acotar.
    private String category;
    private String status;          // ACTIVE | PENDING_PICKUP | CLOSED
    private LocalDateTime closedDate;
    private Boolean recovered;      // respuesta a "¿recuperaste tu objeto?" al cerrar (EU-292)
    // EU-326: URL presignada de la foto con la que se guardó la búsqueda. null si se guardó sin foto
    // (la foto es opcional), en cuyo caso el front muestra el placeholder.
    private String imageUrl;
    // Objeto encontrado que el usuario reconoció como suyo (estado PENDING_PICKUP), y dónde ir a
    // retirarlo. Los tres van juntos y sólo tienen valor en ese estado: si el objeto ya no existe
    // quedan en null y la pantalla no muestra el bloque, en vez de hacer fallar el listado entero.
    private String matchedObjectUuid;
    private String matchedOrganizationName;
    private String matchedOrganizationContactData;
}
