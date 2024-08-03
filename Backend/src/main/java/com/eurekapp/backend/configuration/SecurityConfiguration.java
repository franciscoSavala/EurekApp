package com.eurekapp.backend.configuration;

import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.repository.IOrganizationRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfiguration {
    private final JwtAuthenticationFilter authenticationFilter;
    private final OrganizationAuthorizationFilter organizationAuthorizationFilter;
    private final AuthenticationProvider authenticationProvider;

    public SecurityConfiguration(JwtAuthenticationFilter authenticationFilter,
                                 OrganizationAuthorizationFilter organizationAuthorizationFilter,
                                 AuthenticationProvider authenticationProvider) {
        this.authenticationFilter = authenticationFilter;
        this.organizationAuthorizationFilter = organizationAuthorizationFilter;
        this.authenticationProvider = authenticationProvider;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(authRequest -> authRequest
                        .requestMatchers(HttpMethod.POST,
                                "/found-objects/organizations/**")
                            .hasAuthority(Role.ORGANIZATION_OWNER.name())
                        .requestMatchers( "/**").permitAll())
                .sessionManagement( sessionManager -> sessionManager.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authenticationProvider(authenticationProvider)
                .addFilterBefore(authenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(organizationAuthorizationFilter, JwtAuthenticationFilter.class);

        return http.build();
    }
}
