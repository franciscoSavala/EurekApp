package com.eurekapp.backend.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Entity
@Table(name = "users", uniqueConstraints = {
        @UniqueConstraint(columnNames = "username")
})
public class UserEurekapp implements UserDetails {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Size(min = 3, max = 50, message = "La dirección de correo electrónico debe tener entre 6 y 50 caracteres.")
    @Column(name = "username", nullable = false, length = 50, unique = true)
    private String username;

    @NotNull
    @Size(min = 8, message = "La contraseña debe tener al menos 8 caracteres.")
    @Column(name = "password", nullable = false)
    private String password;

    @Column(name = "active")
    private boolean active;

    @NotNull
    @Size(min = 1, max = 50, message = "El nombre debe tener entre 1 y 50 caracteres.")
    @Column(name = "first_name", nullable = false, length = 50)
    private String firstName;

    @NotNull
    @Size(min = 1, max = 50, message = "El apellido debe tener entre 1 y 50 caracteres.")
    @Column(name = "last_name", nullable = false, length = 50)
    private String lastName;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false)
    private Role role;

    @ManyToOne
    @JoinColumn(name = "organization_id")
    private Organization organization;

    // Implementación de los métodos de la interfaz UserDetails
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority(role.name()));
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return active;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return active;
    }
}
