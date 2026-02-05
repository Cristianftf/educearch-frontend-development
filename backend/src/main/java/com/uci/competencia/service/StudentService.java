package com.uci.competencia.service;

import com.uci.competencia.model.entity.Student;
import com.uci.competencia.model.dto.response.StudentProgressDTO;
import com.uci.competencia.model.dto.response.SearchSessionDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

public interface StudentService {
    Optional<Student> findById(String id);
    Page<Student> findAll(Pageable pageable);
    Student save(Student student);
    void delete(String id);
    
    StudentProgressDTO getStudentProgress(String studentId);
    List<SearchSessionDTO> getSearchHistory(String studentId);
}
