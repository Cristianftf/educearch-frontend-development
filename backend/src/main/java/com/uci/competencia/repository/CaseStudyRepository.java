package com.uci.competencia.repository;

import com.uci.competencia.model.entity.CaseStudy;
import com.uci.competencia.model.enums.CaseStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CaseStudyRepository extends JpaRepository<CaseStudy, String> {

    List<CaseStudy> findByStatus(CaseStatus status);

    Optional<CaseStudy> findById(Long id);

    List<CaseStudy> findByCreatedBy(String professorId);

    @Query("SELECT c FROM CaseStudy c WHERE :studentId MEMBER OF c.assignedStudents")
    List<CaseStudy> findByAssignedStudent(@Param("studentId") String studentId);

    @Query("SELECT c FROM CaseStudy c WHERE :studentId MEMBER OF c.assignedStudents AND c.status = :status")
    List<CaseStudy> findByAssignedStudentAndStatus(@Param("studentId") String studentId, @Param("status") CaseStatus status);
}