package com.uci.competencia.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.setApplicationDestinationPrefixes("/app");
        config.enableSimpleBroker("/topic", "/queue");
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
            .setAllowedOrigins("http://localhost:3000", "http://localhost:3001", "https://frontend.uci.cu")
            .withSockJS()
            .setWebSocketEnabled(true)
            .setHeartbeatTime(25000)
            .setDisconnectDelay(5000);

        registry.addEndpoint("/ws/verification")
            .setAllowedOrigins("http://localhost:3000", "http://localhost:3001", "https://frontend.uci.cu")
            .withSockJS();
    }
}
