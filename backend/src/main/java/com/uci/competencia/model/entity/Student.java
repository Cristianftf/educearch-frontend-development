package com.uci.competencia.model.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "students")
@PrimaryKeyJoinColumn(name = "user_id")
@Data
@lombok.EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
public class Student extends User {
    private String studentId;
    
    private Integer yearOfStudy;
    
    private String program;
    
    @OneToOne(mappedBy = "student", cascade = CascadeType.ALL)
    private CompetencyProgress competencyProgress;
}
