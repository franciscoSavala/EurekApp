package com.eurekapp.backend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * EU-401: la organización vista por un usuario común: el que busca un objeto, el que elige un
 * establecimiento en el buscador y el que viene a retirar.
 *
 * <p>No lleva la información de contacto. Ese campo se rellena solo con el correo del dueño cuando
 * se aprueba la organización, así que dárselo a cualquiera que busque un objeto significaba repartir
 * un correo personal que nadie ofreció como contacto público. Con el nombre y la dirección alcanza
 * para ir a buscarlo.</p>
 *
 * <p>La información de contacto sigue viajando en {@code OrganizationDto}, que es lo que recibe la
 * propia organización de sí misma al iniciar sesión, y en {@code AdminOrganizationDto}.</p>
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class PublicOrganizationDto {
    private Long id;
    private String name;
    private String address;
}
