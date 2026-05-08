package com.uci.competencia.model.entity;

import com.uci.competencia.model.converter.StringUuidConverter;
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
    
    @Column(name = "claim_text", nullable = false, columnDefinition = "TEXT")
    private String claimText;

    @Column(name = "source_url", columnDefinition = "TEXT")
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
    
    @Column(name = "supporting_evidence", columnDefinition = "TEXT")
    private String supportingEvidence;
    
    @Column(name = "conflicting_evidence", columnDefinition = "TEXT")
    private String conflictingEvidence;
    
    @Column(name = "gen_text", columnDefinition = "TEXT")
    private String genText;
    
    @Column(name = "explanations", columnDefinition = "TEXT")
    private String explanations;
    
    @Column(name = "recommendations", columnDefinition = "TEXT")
    private String recommendations;
    
    private Boolean isLearningExample;

    @Convert(converter = StringUuidConverter.class)
    private String sessionContext;
    
    @PrePersist
    protected void onCreate() {
        submittedAt = LocalDateTime.now();
        status = VerificationStatus.PENDING;
    }
}
