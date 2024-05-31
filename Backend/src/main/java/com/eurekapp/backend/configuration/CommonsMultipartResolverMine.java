package com.eurekapp.backend.configuration;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.multipart.support.StandardServletMultipartResolver;

public class CommonsMultipartResolverMine extends StandardServletMultipartResolver {

    @Override
    public boolean isMultipart(HttpServletRequest request) {
        final String header = request.getHeader("Content-Type");
        if(header == null){
            return false;
        }
        return header.contains("multipart/form-data");
    }
}
