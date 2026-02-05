package com.uci.competencia.service.impl;

import com.uci.competencia.model.entity.CaseStudy;
import com.uci.competencia.repository.CaseStudyRepository;
import com.uci.competencia.service.CaseStudyService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class CaseStudyServiceImpl implements CaseStudyService {

    @Autowired
    private CaseStudyRepository caseStudyRepository;

    @Override
    public Optional<CaseStudy> findById(String id) {
        return caseStudyRepository.findById(id);
    }

    @Override
    public Page<CaseStudy> findAll(Pageable pageable) {
        return caseStudyRepository.findAll(pageable);
    }

    @Override
    public CaseStudy save(CaseStudy caseStudy) {
        return caseStudyRepository.save(caseStudy);
    }

    @Override
    public void delete(String id) {
        caseStudyRepository.deleteById(id);
    }
}
