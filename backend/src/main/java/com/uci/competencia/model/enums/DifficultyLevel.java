package com.uci.competencia.model.enums;

public enum DifficultyLevel {
    NOVICE("Novice"),
    INTERMEDIATE("Intermediate"),
    ADVANCED("Advanced");

    private final String displayName;

    DifficultyLevel(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
