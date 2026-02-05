package com.uci.competencia.service;

import com.uci.competencia.model.entity.Professor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;

public interface ProfessorService {
    Optional<Professor> findById(String id);
    Page<Professor> findAll(Pageable pageable);
    Professor save(Professor professor);
    void delete(String id);
}
