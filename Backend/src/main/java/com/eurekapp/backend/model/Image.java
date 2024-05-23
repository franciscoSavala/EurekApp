package com.eurekapp.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Fetch;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class Image {
    private String id;
    private String textEncodind;
}
