package com.uci.competencia.service.impl;

import com.uci.competencia.model.dto.response.SearchSessionDTO;
import com.uci.competencia.model.dto.response.StudentProgressDTO;
import com.uci.competencia.model.entity.Student;
import com.uci.competencia.repository.StudentRepository;
import com.uci.competencia.service.StudentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class StudentServiceImpl implements StudentService {

    @Autowired
    private StudentRepository studentRepository;

    @Override
    public Optional<Student> findById(String id) {
        return studentRepository.findById(id);
    }

    @Override
    public Page<Student> findAll(Pageable pageable) {
        return studentRepository.findAll(pageable);
    }

    @Override
    public Student save(Student student) {
        return studentRepository.save(student);
    }

    @Override
    public void delete(String id) {
        studentRepository.deleteById(id);
    }

    @Override
    public StudentProgressDTO getStudentProgress(String studentId) {
        // Implementación temporal - devolver datos de ejemplo
        StudentProgressDTO progress = new StudentProgressDTO();
        progress.setStudentId(Long.parseLong(studentId));
        progress.setOverallProgress(75.0);
        progress.setCompetencies(java.util.Map.of(
            "access", 80.0,
            "process", 70.0,
            "communicate", 65.0
        ));
        progress.setCasesCompleted(5);
        progress.setTotalCases(10);
        progress.setAverageGrade(85.0);
        progress.setHoursSpent(15.5);
        progress.setActivityStats(java.util.Map.of(
            "searches", 25,
            "verifications", 15,
            "bibliographies", 8
        ));
        progress.setRecommendations(java.util.List.of(
            "Practicar más verificaciones",
            "Mejorar en comunicación de información"
        ));
        return progress;
    }

    @Override
    public java.util.List<SearchSessionDTO> getSearchHistory(String studentId) {
        // Implementación temporal - devolver lista vacía
        return java.util.List.of();
    }
}
