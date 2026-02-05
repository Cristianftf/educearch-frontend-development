package com.uci.competencia.model.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

/**
 * Entidad Badge - Logros y reconocimientos para estudiantes
 */
@Entity
@Table(name = "badges")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Badge {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    
    @Column(nullable = false, length = 100)
    private String name; // "Buscador Experto", "Detector de Infodemia"
    
    @Column(length = 500)
    private String description;
    
    @Column(length = 255)
    private String iconUrl;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BadgeLevel level; // BRONZE, SILVER, GOLD
    
    @Lob
    private String criteria; // JSON con condiciones
    
    @Column(nullable = false)
    private LocalDateTime earnedAt;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    @JsonIgnore
    private Student student;
    
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (earnedAt == null) {
            earnedAt = LocalDateTime.now();
        }
    }
    
    public enum BadgeLevel {
        BRONZE("Bronce", 1),
        SILVER("Plata", 2),
        GOLD("Oro", 3);
        
        private final String displayName;
        private final int value;
        
        BadgeLevel(String displayName, int value) {
            this.displayName = displayName;
            this.value = value;
        }
        
        public String getDisplayName() {
            return displayName;
        }
        
        public int getValue() {
            return value;
        }
    }
}
