package com.eurekapp.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;

@Entity
@Data
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "found_objects")
public class FoundObject {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 500)
    private String humanDescription;

    @Column(length = 500)
    private String openAIDescription;

    @ManyToOne
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Builder
    public FoundObject(String humanDescription, String openAIDescription, String photo, String pineconeVectorId, Organization organization) {
        this.humanDescription = humanDescription;
        this.openAIDescription = openAIDescription;
        this.organization = organization;
    }
}