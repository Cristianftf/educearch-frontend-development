package com.uci.competencia.security;

import com.uci.competencia.model.entity.User;
import com.uci.competencia.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class UserIdentityResolver {

    private final UserRepository userRepository;

    public Optional<String> getCurrentPrincipalIdentifier() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getPrincipal() == null) {
            return Optional.empty();
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof UserDetails userDetails) {
            return normalizeIdentifier(userDetails.getUsername());
        }
        return normalizeIdentifier(principal.toString());
    }

    public Optional<User> resolveCurrentUser() {
        return getCurrentPrincipalIdentifier().flatMap(this::findUserByIdentifier);
    }

    public Optional<User> findUserByIdentifier(String identifier) {
        if (!isResolvableUserIdentifier(identifier)) {
            return Optional.empty();
        }

        String normalized = identifier.trim();
        if (isUuid(normalized)) {
            Optional<User> byId = userRepository.findById(normalized);
            if (byId.isPresent()) {
                return byId;
            }
        }

        Optional<User> byEmail = userRepository.findByEmail(normalized);
        if (byEmail.isPresent()) {
            return byEmail;
        }

        return userRepository.findByUsername(normalized);
    }

    public String resolveCanonicalUserId(String identifier) {
        if (!isResolvableUserIdentifier(identifier)) {
            return identifier;
        }
        return findUserByIdentifier(identifier)
            .map(User::getId)
            .orElse(identifier.trim());
    }

    public Set<String> resolveUserIdentifiers(String identifier) {
        LinkedHashSet<String> identifiers = new LinkedHashSet<>();
        if (!isResolvableUserIdentifier(identifier)) {
            return identifiers;
        }

        identifiers.add(identifier.trim());
        findUserByIdentifier(identifier).ifPresent(user -> addUserIdentifiers(identifiers, user));
        return identifiers;
    }

    public void addUserIdentifiers(Set<String> target, User user) {
        if (target == null || user == null) {
            return;
        }
        if (isResolvableUserIdentifier(user.getId())) {
            target.add(user.getId().trim());
        }
        if (isResolvableUserIdentifier(user.getEmail())) {
            target.add(user.getEmail().trim());
        }
        if (isResolvableUserIdentifier(user.getUsername())) {
            target.add(user.getUsername().trim());
        }
    }

    public boolean isResolvableUserIdentifier(String identifier) {
        if (identifier == null) {
            return false;
        }
        String normalized = identifier.trim();
        return !normalized.isBlank() && !"anonymousUser".equalsIgnoreCase(normalized);
    }

    public boolean isUuid(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        try {
            UUID.fromString(value.trim());
            return true;
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    private Optional<String> normalizeIdentifier(String identifier) {
        if (!isResolvableUserIdentifier(identifier)) {
            return Optional.empty();
        }
        return Optional.of(identifier.trim());
    }
}
