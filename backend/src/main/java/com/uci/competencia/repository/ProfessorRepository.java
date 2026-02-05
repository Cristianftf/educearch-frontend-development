package com.uci.competencia.repository;

import com.uci.competencia.model.entity.Professor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ProfessorRepository extends JpaRepository<Professor, String> {
    Optional<Professor> findByProfessorId(String professorId);
}
