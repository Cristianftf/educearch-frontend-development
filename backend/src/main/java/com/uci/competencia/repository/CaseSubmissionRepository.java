package com.uci.competencia.repository;

import com.uci.competencia.model.entity.CaseSubmission;
import com.uci.competencia.model.enums.SubmissionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CaseSubmissionRepository extends JpaRepository<CaseSubmission, String> {

    List<CaseSubmission> findByCaseId(String caseId);

    List<CaseSubmission> findByStudentId(String studentId);

    Page<CaseSubmission> findByStudentId(String studentId, Pageable pageable);

    Optional<CaseSubmission> findByCaseIdAndStudentId(String caseId, String studentId);

    Optional<CaseSubmission> findByCaseIdAndStudentIdAndStatus(String caseId, String studentId, SubmissionStatus status);

    List<CaseSubmission> findByStatus(SubmissionStatus status);
}
