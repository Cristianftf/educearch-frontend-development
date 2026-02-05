package com.uci.competencia.service;

import com.uci.competencia.model.dto.response.CaseStudyDTO;
import com.uci.competencia.model.dto.response.CaseSubmissionDTO;
import com.uci.competencia.model.enums.CaseStatus;

import java.util.List;
import java.util.Optional;

public interface CaseService {

    // Case Study Management (Professor)
    List<CaseStudyDTO> getAllCases(CaseStatus status);

    Optional<CaseStudyDTO> getCaseById(String id);

    CaseStudyDTO createCase(CaseStudyDTO caseStudy, String professorId);

    CaseStudyDTO updateCase(String id, CaseStudyDTO caseStudy);

    void deleteCase(String id);

    CaseStudyDTO assignStudents(String caseId, List<String> studentIds);

    List<CaseSubmissionDTO> getCaseSubmissions(String caseId);

    // Student Case Access
    List<CaseStudyDTO> getAssignedCases(String studentId);

    List<CaseStudyDTO> getAssignedCasesByStatus(String studentId, CaseStatus status);

    // Case Submissions
    CaseSubmissionDTO submitCase(String caseId, String studentId, CaseSubmissionDTO submission);

    Optional<CaseSubmissionDTO> getSubmission(String caseId, String studentId);

    List<CaseSubmissionDTO> getStudentSubmissions(String studentId);

    // Evaluation (Professor)
    CaseSubmissionDTO evaluateSubmission(String submissionId, CaseSubmissionDTO.EvaluationDTO evaluation, String professorId);
}