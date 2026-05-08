package com.uci.competencia.model.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.JavaType;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Table(name = "search_sessions")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SearchSession {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @ColumnTransformer(read = "CAST(id AS text)", write = "?::uuid")
    @JavaType(com.uci.competencia.model.type.UuidStringJavaType.class)
    @JdbcTypeCode(SqlTypes.UUID)
    private String id;
    
    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;
    
    private String originalQuery;
    private String transformedQuery;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private Integer resultsCount;
    private String searchEngine;
    
    @Column(columnDefinition = "TEXT")
    private String filtersApplied;
    
    private Boolean isPractice = false;
    private Double efficiencyScore;

    private Boolean isFavorite = false;
    
    @Column(columnDefinition = "TEXT")
    private String feedback;
    
    @PrePersist
    protected void onCreate() {
        startedAt = LocalDateTime.now();
    }
}
