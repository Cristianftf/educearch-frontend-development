package com.uci.competencia.model.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Set;

@Entity
@Table(name = "professors")
@PrimaryKeyJoinColumn(name = "user_id")
@Data
@lombok.EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
public class Professor extends User {
    private String professorId;
    
    private String academicTitle;
    
    private String researchArea;
    
    @ElementCollection
    @CollectionTable(name = "professor_expertise")
    private Set<String> expertiseAreas;
}
