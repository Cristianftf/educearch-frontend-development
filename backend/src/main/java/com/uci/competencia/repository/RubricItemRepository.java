package com.uci.competencia.repository;

import com.uci.competencia.model.entity.RubricItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RubricItemRepository extends JpaRepository<RubricItem, String> {
    
    List<RubricItem> findByCaseId(String caseId);
    
    void deleteByCaseId(String caseId);
    
    long countByCaseId(String caseId);
}
