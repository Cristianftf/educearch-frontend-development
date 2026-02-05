package com.uci.competencia.model.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "competency_progress")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CompetencyProgress {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    
    @OneToOne
    @JoinColumn(name = "student_id")
    private Student student;
    
    // Competencia de Acceso
    private Double accessScore;
    private Integer totalSearches;
    private Integer successfulSearches;
    private Double avgSearchTime;
    private Integer meshTermsMastered;
    
    // Competencia de Procesamiento
    private Double processingScore;
    private Integer totalVerifications;
    private Integer correctVerifications;
    private Double avgVerificationConfidence;
    private String strongestArea;
    
    // Competencia de Comunicación
    private Double communicationScore;
    private Integer bibliographiesGenerated;
    private Double citationAccuracy;
    private Integer peerReviewsCompleted;
    
    private LocalDateTime lastUpdated;
    
    @PreUpdate
    protected void onUpdate() {
        lastUpdated = LocalDateTime.now();
    }
}
