DROP TABLE IF EXISTS reward_exclusions;
DROP TABLE IF EXISTS user_eurekapp;
DROP TABLE IF EXISTS organizations;

create table organizations
(
    id           bigint
        primary key,
    name         varchar(255) not null,
    contact_data varchar(255) not null
);

-- auto-generated definition
create table user_eurekapp
(
    id              bigint
        primary key,
    active          bit                                                                                    not null,
    password        varchar(255)                                                                           not null,
    role            enum ('USER', 'ORGANIZATION_OWNER', 'ORGANIZATION_EMPLOYEE', 'ENCARGADO', 'ADMIN')    null,
    username        varchar(255)                                                                           not null,
    organization_id bigint                                                                                 null,
    constraint UK_9p4pgp1md8tx7nvj08ihqxjsv
        unique (organization_id),
    constraint UKrs5k9bfvq3m3hdc4lab4qsi9w
        unique (username),
    constraint FKga8ka6eykpjg35pxphn6xl07j
        foreign key (organization_id) references organizations (id)
);

create table reward_exclusions
(
    id                bigint auto_increment primary key,
    found_object_uuid varchar(255) not null,
    user_id           bigint       not null,
    user_role         varchar(50)  not null,
    reason            varchar(100) not null,
    excluded_at       datetime     not null,
    organization_id   varchar(255) not null,
    constraint FKreward_excl_user
        foreign key (user_id) references user_eurekapp (id)
);