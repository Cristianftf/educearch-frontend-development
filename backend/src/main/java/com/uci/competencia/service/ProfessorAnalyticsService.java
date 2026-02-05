package com.uci.competencia.service;

import com.uci.competencia.model.dto.response.ProfessorAnalyticsDTO;
import com.uci.competencia.model.dto.response.StudentProgressDTO;
import com.uci.competencia.model.dto.response.CaseStudyDTO;

import java.util.List;
import java.util.Map;

public interface ProfessorAnalyticsService {
    ProfessorAnalyticsDTO getAnalyticsOverview(String professorId);
    StudentProgressDTO getStudentAnalytics(String studentId);
    
    List<StudentProgressDTO> getProfessorStudents(String professorId);
    List<CaseStudyDTO> getProfessorCases(String professorId);
    CaseStudyDTO createCaseStudy(CaseStudyDTO caseData, String professorId);
    Map<String, Object> getClassPerformanceMetrics(String professorId);
}
