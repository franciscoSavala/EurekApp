-- Fixtures minimos para EndpointSecurityTest (el esquema lo crea schema.sql). Las columnas van
-- nombradas: si el modelo cambia, el INSERT falla en el nombre y no en un orden posicional silencioso.
INSERT INTO organizations (id, name, contact_data, active) VALUES (1, 'utn', 'utn-contactdata', 1);
INSERT INTO organizations (id, name, contact_data, active) VALUES (2, 'patio olmos', 'patio olmos-contactdata', 1);

INSERT INTO users (id, username, password, active, first_name, last_name, role, organization_id, xp, returned_objects)
VALUES (9, 'fsavala', '$2a$10$XbygLSF5StHZfd3aXaRWYOZViU/ERg6JfRjsjsewf4lIn/VkiDgoG', true, 'Facundo', 'Savala', 'USER', null, 0, 0);
INSERT INTO users (id, username, password, active, first_name, last_name, role, organization_id, xp, returned_objects)
VALUES (11, 'utn-admin', '$2a$10$XbygLSF5StHZfd3aXaRWYOZViU/ERg6JfRjsjsewf4lIn/VkiDgoG', true, 'Admin', 'Utn', 'ORGANIZATION_OWNER', 1, 0, 0);
INSERT INTO users (id, username, password, active, first_name, last_name, role, organization_id, xp, returned_objects)
VALUES (12, 'patio-olmos-admin', '$2a$10$XbygLSF5StHZfd3aXaRWYOZViU/ERg6JfRjsjsewf4lIn/VkiDgoG', true, 'Admin', 'Olmos', 'ORGANIZATION_OWNER', 2, 0, 0);
