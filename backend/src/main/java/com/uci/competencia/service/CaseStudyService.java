package com.uci.competencia.service;

import com.uci.competencia.model.entity.CaseStudy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;

public interface CaseStudyService {
    Optional<CaseStudy> findById(String id);
    Page<CaseStudy> findAll(Pageable pageable);
    CaseStudy save(CaseStudy caseStudy);
    void delete(String id);
}
