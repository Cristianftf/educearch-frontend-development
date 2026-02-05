package com.uci.competencia.model.enums;

public enum ActionType {
    LOGIN("LOGIN"),
    LOGOUT("LOGOUT"),
    SEARCH("SEARCH"),
    VERIFY("VERIFY"),
    EXPORT("EXPORT"),
    CREATE_CASE("CREATE_CASE"),
    SUBMIT_CASE("SUBMIT_CASE"),
    GRADE_CASE("GRADE_CASE"),
    CREATE_USER("CREATE_USER"),
    UPDATE_USER("UPDATE_USER"),
    DELETE_USER("DELETE_USER"),
    CHANGE_SETTINGS("CHANGE_SETTINGS"),
    VIEW_ANALYTICS("VIEW_ANALYTICS"),
    GENERATE_REPORT("GENERATE_REPORT"),
    BACKUP("BACKUP"),
    RESTORE("RESTORE");

    private final String value;

    ActionType(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}
