package com.eurekapp.backend.configuration.security;

import com.eurekapp.backend.exception.ApiError;
import com.eurekapp.backend.model.UserEurekapp;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final static String BEARER = "Bearer ";
    private final JwtService jwtService;
    private final UserDetailsService userService;
    private final ObjectMapper objectMapper;

    public JwtAuthenticationFilter(JwtService jwtService, UserDetailsService userService, ObjectMapper objectMapper) {
        this.jwtService = jwtService;
        this.userService = userService;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {
        final String authHeader = request.getHeader("Authorization");
        if(authHeader == null || !authHeader.startsWith(BEARER)){
            filterChain.doFilter(request, response);
            return;
        }
        String jwt = authHeader.substring(BEARER.length());
        try {
            String userName = jwtService.getUsername(jwt);
            if(userName != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                UserDetails userDetails = userService.loadUserByUsername(userName);
                if(jwtService.isTokenValid(jwt, userDetails)){
                    UserEurekapp eurekappUser = (UserEurekapp) userDetails;
                    if (!eurekappUser.isActive()) {
                        writeErrorResponse(response, "user_deactivated",
                                "Tu cuenta fue desactivada. Contactá al administrador de EurekApp.");
                        return;
                    }
                    if (eurekappUser.getOrganization() != null && !eurekappUser.getOrganization().isActive()) {
                        writeErrorResponse(response, "org_deactivated",
                                "Tu organización fue desactivada.");
                        return;
                    }
                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userDetails,
                            null,
                            userDetails.getAuthorities());

                    authToken.setDetails(
                            new WebAuthenticationDetailsSource().buildDetails(request)
                    );
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }
        } catch (JwtException e) {
            // Token malformado o inválido — continuamos sin autenticar
        }
        filterChain.doFilter(request, response);
    }

    private void writeErrorResponse(HttpServletResponse response, String error, String message) throws IOException {
        ApiError apiError = ApiError.builder()
                .error(error)
                .message(message)
                .status(HttpServletResponse.SC_UNAUTHORIZED)
                .build();
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        objectMapper.writeValue(response.getWriter(), apiError);
    }
}
