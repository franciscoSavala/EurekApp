package com.eurekapp.backend.repository;


import com.eurekapp.backend.model.FoundObject;
import com.eurekapp.backend.service.client.WeaviateService;

import io.weaviate.client.v1.data.model.WeaviateObject;
import io.weaviate.client.v1.filters.WhereFilter;
import io.weaviate.client.v1.filters.Operator;

import org.springframework.stereotype.Component;

import java.time.*;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;