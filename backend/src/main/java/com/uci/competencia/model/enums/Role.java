package com.uci.competencia.model.enums;

public enum Role {
    ROLE_STUDENT("STUDENT"),
    ROLE_PROFESSOR("PROFESSOR"),
    ROLE_ADMIN("ADMIN");

    private final String displayName;

    Role(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
