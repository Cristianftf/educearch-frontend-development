package com.uci.competencia.repository;

import com.uci.competencia.model.entity.SearchHedge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SearchHedgeRepository extends JpaRepository<SearchHedge, String> {
    
    List<SearchHedge> findByCreatedBy(String createdBy);
    
    List<SearchHedge> findByCategory(String category);
    
    List<SearchHedge> findByCreatedByAndCategory(String createdBy, String category);

    Optional<SearchHedge> findByIdAndCreatedBy(String id, String createdBy);
    
    List<SearchHedge> findByIsTemplate(Boolean isTemplate);
}
