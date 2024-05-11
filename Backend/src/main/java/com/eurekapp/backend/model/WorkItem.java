package com.eurekapp.backend.model;

import lombok.Builder;
import lombok.Data;


@Data
@Builder
public class WorkItem {
    private String key;
    private String name;
    private String confidence;
}
