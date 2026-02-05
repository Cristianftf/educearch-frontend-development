package com.uci.competencia.model.entity;

import com.uci.competencia.model.enums.Verdict;
import com.uci.competencia.model.enums.VerificationStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "verification_results")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VerificationResult {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    
    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;
    
    private String claimText;
    private String sourceUrl;
    private LocalDateTime submittedAt;
    private LocalDateTime completedAt;
    
    private Double overallScore;
    
    @Enumerated(EnumType.STRING)
    private Verdict verdict;
    
    @Enumerated(EnumType.STRING)
    private VerificationStatus status;
    
    private Double confidence;
    private Integer evidenceCount;
    
    @Lob
    private String supportingEvidence;
    
    @Lob
    private String conflictingEvidence;
    
    @Lob
    private String genText;
    
    @Lob
    private String explanations;
    
    @Lob
    private String recommendations;
    
    private Boolean isLearningExample;
    private String sessionContext;
    
    @PrePersist
    protected void onCreate() {
        submittedAt = LocalDateTime.now();
        status = VerificationStatus.PENDING;
    }
}
