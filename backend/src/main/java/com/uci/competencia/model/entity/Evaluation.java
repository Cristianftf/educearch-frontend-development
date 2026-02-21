package com.uci.competencia.model.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Table(name = "evaluations")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Evaluation {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    
    @Column(nullable = false)
    private String submissionId;
    
    @Column(nullable = false)
    private String professorId;
    
    // Scores como JSON
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String scores;  // {"access": 85, "process": 72, "communicate": 78}
    
    // Comments como JSON
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String comments;  // {"access": "Good", "process": "Needs work", ...}
    
    @Column(nullable = false)
    private Integer overallScore;
    
    @Column(length = 2000)
    private String feedback;
    
    @CreationTimestamp
    private LocalDateTime evaluatedAt;
    
    @Column(nullable = false)
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    /**
     * Obtiene el JSON de scores (alias para getScores)
     */
    public String getScoresJson() {
        return this.scores;
    }

    /**
     * Obtiene el JSON de comments (alias para getComments)
     */
    public String getCommentsJson() {
        return this.comments;
    }

    /**
     * Establece los scores desde JSON (alias para setScores)
     */
    public void setScoresJson(String scoresJson) {
        this.scores = scoresJson;
    }

    /**
     * Establece los comments desde JSON (alias para setComments)
     */
    public void setCommentsJson(String commentsJson) {
        this.comments = commentsJson;
    }
}
