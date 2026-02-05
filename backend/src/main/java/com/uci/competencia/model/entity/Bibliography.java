package com.uci.competencia.model.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Entidad Bibliography - Bibliografías generadas por usuarios
 */
@Entity
@Table(name = "bibliographies", indexes = {
    @Index(name = "idx_bibliography_user", columnList = "user_id"),
    @Index(name = "idx_bibliography_created_at", columnList = "created_at")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Bibliography {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    
    @Column(name = "user_id", nullable = false)
    private String userId;
    
    @Column(nullable = false, length = 255)
    private String name;
    
    @Column(nullable = false, length = 50)
    private String format; // 'apa', 'vancouver', 'bibtex', 'xml'
    
    @Lob
    @Column(columnDefinition = "TEXT")
    private String content; // Contenido de la bibliografía generada

    @Lob
    @Column(columnDefinition = "TEXT")
    private String articleIds; // JSON array of article IDs
    
    @Column(name = "article_count", nullable = false)
    private Integer articleCount;
    
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        if (this.articleCount == null) {
            this.articleCount = 0;
        }
    }
}
