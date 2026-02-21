package com.uci.competencia.model.dto.response;

import lombok.Data;

@Data
public class ChatContactDTO {
    private String email;
    private String name;
    private String role;
    private String avatar;
    private String faculty;
    private long unreadCount;
}
