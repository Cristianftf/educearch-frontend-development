package com.uci.competencia.service;

import com.uci.competencia.model.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;

public interface UserService {
    Optional<User> findById(String id);
    Optional<User> findByUsername(String username);
    Page<User> findAll(Pageable pageable);
    User save(User user);
    void delete(String id);
    boolean existsByUsername(String username);
}
