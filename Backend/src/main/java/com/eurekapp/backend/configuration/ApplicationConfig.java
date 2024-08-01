package com.eurekapp.backend.configuration;

import com.eurekapp.backend.exception.AuthenticationException;
import com.eurekapp.backend.repository.IUserRepository;
import com.eurekapp.backend.service.client.EmbeddingService;
import com.eurekapp.backend.service.client.ImageDescriptionService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import java.util.List;
import java.util.stream.IntStream;

@Configuration
public class ApplicationConfig {

    private final IUserRepository userRepository;

    public ApplicationConfig(IUserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Bean
    public UserDetailsService userDetailsService() {
        return username -> userRepository.findByUsername(username)
                .orElseThrow(() -> new AuthenticationException("No existe un usuario con ese nombre"));
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService());
        authProvider.setPasswordEncoder(new BCryptPasswordEncoder());
        return authProvider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    @Profile({"local", "test"})
    public EmbeddingService embeddingService() {
        return t -> List.of(1f,1f,1f,1f);
    }

    @Bean
    @Profile({"local", "test"})
    public ImageDescriptionService imageDescriptionService() {
        return bytes -> "some description";
    }
}
