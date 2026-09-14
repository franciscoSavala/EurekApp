package com.eurekapp.backend.util;

import com.eurekapp.backend.model.Organization;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

// ─── EU-401: la dirección que se le muestra a quien viene a retirar ───────────────────────────
//
// Reemplaza a la "información de contacto" de la organización, que al aprobarla se rellena sola con
// el correo del dueño: un dato personal que nadie ofreció como contacto público.

class OrganizationAddressTest {

    private Organization org(String street, String number, String city, String province) {
        return Organization.builder()
                .name("Terminal de Ómnibus")
                .street(street)
                .streetNumber(number)
                .city(city)
                .province(province)
                .country("Argentina")
                .build();
    }

    @Test
    void arma_calle_altura_ciudad_y_provincia() {
        assertThat(OrganizationAddress.format(org("Bvd. Perón", "380", "Córdoba", "Santa Fe")))
                .isEqualTo("Bvd. Perón 380, Córdoba, Santa Fe");
    }

    @Test
    void no_repite_la_provincia_cuando_se_llama_igual_que_la_ciudad() {
        // Córdoba capital: "Córdoba, Córdoba" no le dice nada a nadie.
        assertThat(OrganizationAddress.format(org("Bvd. Perón", "380", "Córdoba", "Córdoba")))
                .isEqualTo("Bvd. Perón 380, Córdoba");
    }

    @Test
    void se_arma_con_lo_que_haya() {
        // Ninguno de los campos es obligatorio en la base.
        assertThat(OrganizationAddress.format(org("Bvd. Perón", null, "Córdoba", "Córdoba")))
                .isEqualTo("Bvd. Perón, Córdoba");
        assertThat(OrganizationAddress.format(org(null, null, "Córdoba", "Córdoba")))
                .isEqualTo("Córdoba");
        assertThat(OrganizationAddress.format(org("  ", "  ", "  ", "  ")))
                .isEmpty();
    }

    @Test
    void nunca_deja_ver_la_palabra_null_ni_comas_sueltas() {
        String direccion = OrganizationAddress.format(org(null, "380", null, "Córdoba"));
        assertThat(direccion).doesNotContain("null").doesNotStartWith(",").doesNotEndWith(",");
    }

    @Test
    void sin_organizacion_no_se_rompe() {
        assertThat(OrganizationAddress.format(null)).isEmpty();
    }

    @Test
    void no_lleva_la_informacion_de_contacto() {
        // Lo que se estaba filtrando: el correo personal del dueño, que vive en ese mismo registro.
        Organization organization = org("Bvd. Perón", "380", "Córdoba", "Córdoba");
        organization.setContactData("duenio.personal@gmail.com");

        assertThat(OrganizationAddress.format(organization)).doesNotContain("@");
    }
}
