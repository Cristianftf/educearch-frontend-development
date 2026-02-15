package com.uci.competencia.repository;

import com.uci.competencia.model.entity.Evaluation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EvaluationRepository extends JpaRepository<Evaluation, String> {
    Optional<Evaluation> findBySubmissionId(String submissionId);
    List<Evaluation> findBySubmissionIdIn(List<String> submissionIds);
    List<Evaluation> findByProfessorId(String professorId);
}
