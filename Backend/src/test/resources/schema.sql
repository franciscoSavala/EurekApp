-- Esquema minimo para EndpointSecurityTest, en sintaxis H2. Solo las dos tablas que el test toca
-- (el resto de los servicios estan mockeados). Tiene que seguir a las entidades Organization y
-- UserEurekapp: si se les agrega una columna NOT NULL, hay que agregarla aca.
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS organizations;

CREATE TABLE organizations
(
    id                BIGINT PRIMARY KEY,
    name              VARCHAR(255),
    contact_data      VARCHAR(255),
    street            VARCHAR(255),
    street_number     VARCHAR(255),
    city              VARCHAR(255),
    province          VARCHAR(255),
    country           VARCHAR(255),
    organization_type VARCHAR(50),
    latitude          DOUBLE,
    longitude         DOUBLE,
    active            BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE users
(
    id                          BIGINT PRIMARY KEY,
    username                    VARCHAR(100) NOT NULL UNIQUE,
    password                    VARCHAR(255) NOT NULL,
    active                      BOOLEAN,
    first_name                  VARCHAR(50)  NOT NULL,
    last_name                   VARCHAR(50)  NOT NULL,
    role                        VARCHAR(50)  NOT NULL,
    organization_id             BIGINT REFERENCES organizations (id),
    xp                          BIGINT       NOT NULL DEFAULT 0,
    returned_objects            BIGINT       NOT NULL DEFAULT 0,
    provider_type               VARCHAR(20),
    provider_id                 VARCHAR(255),
    password_reset_token        VARCHAR(10),
    password_reset_token_expiry TIMESTAMP
);
