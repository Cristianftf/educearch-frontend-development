package com.uci.competencia.service.specification;

import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.enums.Role;
import org.springframework.data.jpa.domain.Specification;

public final class UserSpecifications {

    private UserSpecifications() {
    }

    public static Specification<User> hasRole(Role role) {
        return (root, query, cb) -> role == null ? cb.conjunction() : cb.equal(root.get("role"), role);
    }

    public static Specification<User> hasActive(Boolean active) {
        return (root, query, cb) -> active == null ? cb.conjunction() : cb.equal(root.get("active"), active);
    }

    public static Specification<User> containsSearch(String search) {
        return (root, query, cb) -> {
            if (search == null || search.isBlank()) {
                return cb.conjunction();
            }
            String like = "%" + search.trim().toLowerCase() + "%";
            return cb.or(
                cb.like(cb.lower(root.get("email")), like),
                cb.like(cb.lower(root.get("username")), like),
                cb.like(cb.lower(cb.coalesce(root.get("firstName"), "")), like),
                cb.like(cb.lower(cb.coalesce(root.get("lastName"), "")), like),
                cb.like(cb.lower(cb.coalesce(root.get("faculty"), "")), like)
            );
        };
    }
}
