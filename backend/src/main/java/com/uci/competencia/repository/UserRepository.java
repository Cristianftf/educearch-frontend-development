package com.uci.competencia.repository;

import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.enums.Role;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, String> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    Page<User> findByRole(Role role, Pageable pageable);
    Page<User> findByFaculty(String faculty, Pageable pageable);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
}
