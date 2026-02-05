package com.uci.competencia.repository;

import com.uci.competencia.model.entity.VerificationResult;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface VerificationResultRepository extends JpaRepository<VerificationResult, String> {
    Page<VerificationResult> findByUser_Id(String userId, Pageable pageable);
}
