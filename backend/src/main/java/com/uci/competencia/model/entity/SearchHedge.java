package com.uci.competencia.model.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "search_hedges")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SearchHedge {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    
    @Column(nullable = false)
    private String name;
    
    @Column(nullable = false)
    private String category;
    
    @Column(nullable = false, length = 2000)
    private String query;
    
    @Column(length = 1000)
    private String description;
    
    private Integer estimatedResults;
    
    private Double precision;
    
    private Double recall;
    
    @Column(nullable = false)
    private String createdBy;  // Professor ID
    
    @CreationTimestamp
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;
    
    @Column(columnDefinition = "boolean default false")
    private Boolean isTemplate = false;
    
    @PrePersist
    protected void onCreate() {
        if (updatedAt == null) {
            updatedAt = LocalDateTime.now();
        }
        if (isTemplate == null) {
            isTemplate = false;
        }
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
