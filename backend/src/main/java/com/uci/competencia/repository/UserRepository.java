package com.uci.competencia.repository;

import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.enums.Role;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, String>, JpaSpecificationExecutor<User> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    List<User> findByRole(Role role);
    Page<User> findByRole(Role role, Pageable pageable);
    Page<User> findByActive(boolean active, Pageable pageable);
    Page<User> findByRoleAndActive(Role role, boolean active, Pageable pageable);
    Page<User> findByFaculty(String faculty, Pageable pageable);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    long countByRole(Role role);
    long countByRoleAndActive(Role role, boolean active);
    long countByActive(boolean active);
    long countByCreatedAtBetween(LocalDateTime start, LocalDateTime end);
    long countByRoleAndCreatedAtBetween(Role role, LocalDateTime start, LocalDateTime end);
}
