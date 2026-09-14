package com.eurekapp.backend.util;

import com.eurekapp.backend.model.Organization;

/***
 *      EU-401: la dirección de una organización, armada para mostrársela a quien viene a retirar
 *      un objeto.
 *
 *      Hasta ahora lo que se le daba era el campo "información de contacto", que al aprobar una
 *      organización se rellena solo con el correo del dueño. Ese correo es un dato personal que
 *      nadie ofreció como contacto público. Con el nombre y la dirección alcanza: quien sabe dónde
 *      está su objeto se arregla para llegar.
 *
 *      Se arma con lo que haya. Ninguno de los campos es obligatorio en la base, así que los vacíos
 *      se saltean en lugar de dejar comas sueltas o la palabra "null" a la vista.
 * ***/
public class OrganizationAddress {

    private OrganizationAddress() {
        throw new UnsupportedOperationException("Utility class cannot be instantiated");
    }

    public static String format(Organization organization) {
        if (organization == null) {
            return "";
        }

        String street = join(" ", organization.getStreet(), organization.getStreetNumber());
        String city = blankToNull(organization.getCity());
        String province = blankToNull(organization.getProvince());

        /* En Córdoba capital la ciudad y la provincia se llaman igual, y "Córdoba, Córdoba" no
           agrega nada: en ese caso la provincia se omite. */
        if (province != null && province.equalsIgnoreCase(city)) {
            province = null;
        }

        return join(", ", street, city, province);
    }

    private static String join(String separator, String... parts) {
        StringBuilder joined = new StringBuilder();
        for (String part : parts) {
            if (blankToNull(part) == null) {
                continue;
            }
            if (joined.length() > 0) {
                joined.append(separator);
            }
            joined.append(part.trim());
        }
        return joined.toString();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
