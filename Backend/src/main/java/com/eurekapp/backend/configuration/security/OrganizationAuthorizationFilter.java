package com.eurekapp.backend.configuration.security;

import com.eurekapp.backend.exception.ForbbidenException;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.Role;
import com.eurekapp.backend.model.UserEurekapp;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class OrganizationAuthorizationFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {
        String path = request.getRequestURI();

        if (path.startsWith("/found-objects/organizations/")) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication == null || !authentication.isAuthenticated()) {
                filterChain.doFilter(request, response);
            }

            String role = authentication.getAuthorities().stream()
                    .map(GrantedAuthority::getAuthority)
                    .findFirst()
                    .orElse(null);

            if (role == null || !role.startsWith(Role.ORGANIZATION_OWNER.name())) {
                filterChain.doFilter(request, response);
                return;
            }

            // Extract organization ID from the URL
            String[] pathParts = path.split("/");
            Long organizationIdFromPath = Long.valueOf(pathParts[pathParts.length - 1]);

            // Extract user-specific organization ID (implement your logic here)
            Long userOrganizationId = getUserOrganizationId(authentication);

            if (!organizationIdFromPath.equals(userOrganizationId)) {
                throw new ForbbidenException("not_valid_credentials", "User does not have access to this organization");
            }
        }

        filterChain.doFilter(request, response);
    }

    private Long getUserOrganizationId(Authentication authentication) {
        UserEurekapp user = (UserEurekapp) authentication.getPrincipal();
        Organization organization = user.getOrganization();
        if (organization == null) throw new ForbbidenException("not_org_owner", "User is not an organization owner");
        return organization.getId();
    }
}