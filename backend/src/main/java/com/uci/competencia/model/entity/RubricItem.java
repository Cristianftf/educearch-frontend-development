package com.uci.competencia.model.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "rubric_items")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RubricItem {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    
    @Column(nullable = false)
    private String caseId;
    
    @Column(nullable = false)
    private String competency;  // 'access' | 'process' | 'communicate'
    
    @Column(nullable = false, length = 500)
    private String criterion;
    
    @Column(nullable = false)
    private Integer maxScore;
    
    @Column(length = 1000)
    private String description;
    
    @Column(nullable = false)
    private Integer orderIndex = 0;  // Para mantener el orden de los ítems
}
