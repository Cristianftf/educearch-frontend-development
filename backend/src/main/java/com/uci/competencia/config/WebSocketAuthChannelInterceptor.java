package com.uci.competencia.config;

import com.uci.competencia.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketAuthChannelInterceptor implements ChannelInterceptor {

    private final JwtTokenProvider jwtTokenProvider;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            return message;
        }

        StompCommand command = accessor.getCommand();
        if (StompCommand.CONNECT.equals(command)) {
            authenticateConnect(accessor);
        } else if ((StompCommand.SEND.equals(command) || StompCommand.SUBSCRIBE.equals(command))
            && accessor.getUser() == null) {
            throw new AccessDeniedException("Unauthenticated websocket message");
        }

        return message;
    }

    private void authenticateConnect(StompHeaderAccessor accessor) {
        String authHeader = resolveAuthorizationHeader(accessor);
        if (!StringUtils.hasText(authHeader)) {
            throw new AccessDeniedException("Missing Authorization header in STOMP CONNECT");
        }

        String token = extractToken(authHeader);
        if (!StringUtils.hasText(token) || !jwtTokenProvider.validateToken(token)) {
            throw new AccessDeniedException("Invalid websocket auth token");
        }

        String username = jwtTokenProvider.getUsernameFromToken(token);
        String authorities = jwtTokenProvider.getAuthoritiesFromToken(token);
        List<GrantedAuthority> grantedAuthorities = parseAuthorities(authorities);

        UsernamePasswordAuthenticationToken authentication =
            new UsernamePasswordAuthenticationToken(username, null, grantedAuthorities);

        accessor.setUser(authentication);
        log.debug("WebSocket authenticated for user: {}", username);
    }

    private String resolveAuthorizationHeader(StompHeaderAccessor accessor) {
        String authHeader = accessor.getFirstNativeHeader("Authorization");
        if (!StringUtils.hasText(authHeader)) {
            authHeader = accessor.getFirstNativeHeader("authorization");
        }
        return authHeader;
    }

    private String extractToken(String authHeader) {
        String trimmed = authHeader.trim();
        if (trimmed.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return trimmed.substring(7).trim();
        }
        return trimmed;
    }

    private List<GrantedAuthority> parseAuthorities(String authoritiesRaw) {
        if (!StringUtils.hasText(authoritiesRaw)) {
            return Collections.emptyList();
        }
        return Arrays.stream(authoritiesRaw.split(","))
            .map(String::trim)
            .filter(StringUtils::hasText)
            .map(SimpleGrantedAuthority::new)
            .collect(Collectors.toList());
    }
}
