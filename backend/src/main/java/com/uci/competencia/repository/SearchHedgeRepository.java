package com.uci.competencia.repository;

import com.uci.competencia.model.entity.SearchHedge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SearchHedgeRepository extends JpaRepository<SearchHedge, String> {
    
    List<SearchHedge> findByCreatedBy(String createdBy);
    
    List<SearchHedge> findByCategory(String category);
    
    List<SearchHedge> findByCreatedByAndCategory(String createdBy, String category);
    
    List<SearchHedge> findByIsTemplate(Boolean isTemplate);
}
