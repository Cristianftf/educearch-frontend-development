package com.uci.competencia.repository;

import com.uci.competencia.model.entity.CompetencyProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CompetencyProgressRepository extends JpaRepository<CompetencyProgress, String> {
    Optional<CompetencyProgress> findByStudentId(String studentId);
}
