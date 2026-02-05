package com.uci.competencia.model.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "administrators")
@PrimaryKeyJoinColumn(name = "user_id")
@Data
@lombok.EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
public class Administrator extends User {
    private String adminLevel;
    
    private String managedFaculties;
    
    private boolean canImpersonate;
    
    private boolean canAudit;
}
