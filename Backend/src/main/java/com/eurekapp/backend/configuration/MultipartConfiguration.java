package com.eurekapp.backend.configuration;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.multipart.MultipartResolver;
import org.springframework.web.multipart.support.StandardServletMultipartResolver;

@Configuration
public class MultipartConfiguration {
    public MultipartResolver multipartResolver() {
        return new StandardServletMultipartResolver();
    }
}

