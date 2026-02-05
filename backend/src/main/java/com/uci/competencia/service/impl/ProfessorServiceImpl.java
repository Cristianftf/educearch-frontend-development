package com.uci.competencia.service.impl;

import com.uci.competencia.model.entity.Professor;
import com.uci.competencia.repository.ProfessorRepository;
import com.uci.competencia.service.ProfessorService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class ProfessorServiceImpl implements ProfessorService {

    @Autowired
    private ProfessorRepository professorRepository;

    @Override
    public Optional<Professor> findById(String id) {
        return professorRepository.findById(id);
    }

    @Override
    public Page<Professor> findAll(Pageable pageable) {
        return professorRepository.findAll(pageable);
    }

    @Override
    public Professor save(Professor professor) {
        return professorRepository.save(professor);
    }

    @Override
    public void delete(String id) {
        professorRepository.deleteById(id);
    }
}
