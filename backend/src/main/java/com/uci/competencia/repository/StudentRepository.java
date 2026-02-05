package com.uci.competencia.repository;

import com.uci.competencia.model.entity.Student;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface StudentRepository extends JpaRepository<Student, String> {
    Optional<Student> findByStudentId(String studentId);
    Page<Student> findByFaculty(String faculty, Pageable pageable);
    Page<Student> findByProgram(String program, Pageable pageable);
}
