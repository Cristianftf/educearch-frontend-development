package com.uci.competencia.model.entity;

import com.uci.competencia.model.enums.StudyType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Entity
@Table(name = "search_results")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SearchResult {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    
    private String pmid;
    private String title;
    
    @Lob
    private String abstractText;
    
    private String authors;
    private String journal;
    private LocalDate publicationDate;
    private Integer publicationYear;  // Nuevo campo para año como número
    
    @Enumerated(EnumType.STRING)
    private StudyType studyType;
    
    private Integer evidenceLevel;
    private Double relevanceScore;
    private Boolean hasFullText;
    private String fullTextUrl;
    
    // Nuevos campos para coherencia con frontend
    private Integer sampleSize;
    private Boolean hasConflictOfInterest;
    private String doi;
    
    @ElementCollection
    @CollectionTable(name = "result_mesh_terms")
    private List<String> meshTerms;
    
    @Lob
    private String metadata;
}
