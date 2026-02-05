package com.uci.competencia.aspect;

import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.*;
import org.springframework.stereotype.Component;

/**
 * Aspecto AOP para logging estructurado de entrada/salida
 * 
 * Registra:
 * - Parámetros de entrada
 * - Valor de retorno
 * - Excepciones
 * - Información de contexto (usuario, timestamp, etc)
 */
@Aspect
@Component
@Slf4j
public class LoggingAspect {
    
    /**
     * Logging completo alrededor de métodos de controlador
     */
    @Around("execution(* com.uci.competencia.controller.api..*.*(..))")
    public Object logControllerExecution(ProceedingJoinPoint joinPoint) throws Throwable {
        String methodName = joinPoint.getSignature().getName();
        Object[] args = joinPoint.getArgs();
        
        // Log de entrada
        log.info(">>> Controller Method: {} | Args: {}",
            methodName,
            serializeArguments(args)
        );
        
        long startTime = System.currentTimeMillis();
        
        try {
            Object result = joinPoint.proceed();
            
            long duration = System.currentTimeMillis() - startTime;
            
            // Log de salida exitosa
            log.info("<<< Controller Method: {} | Result: {} | Duration: {}ms",
                methodName,
                serializeResult(result),
                duration
            );
            
            return result;
        } catch (Exception ex) {
            long duration = System.currentTimeMillis() - startTime;
            
            // Log de error
            log.error("!!! Controller Method: {} | Exception: {} | Duration: {}ms | Message: {}",
                methodName,
                ex.getClass().getSimpleName(),
                duration,
                ex.getMessage(),
                ex
            );
            
            throw ex;
        }
    }
    
    /**
     * Logging de métodos de servicio
     */
    @Around("execution(* com.uci.competencia.service..*.*(..))")
    public Object logServiceExecution(ProceedingJoinPoint joinPoint) throws Throwable {
        String className = joinPoint.getSignature().getDeclaringType().getSimpleName();
        String methodName = joinPoint.getSignature().getName();
        Object[] args = joinPoint.getArgs();
        
        // Log de entrada
        log.debug(">>> Service Method: {}.{} | Args: {}",
            className,
            methodName,
            serializeArguments(args)
        );
        
        try {
            Object result = joinPoint.proceed();
            
            // Log de salida exitosa
            log.debug("<<< Service Method: {}.{} | Success",
                className,
                methodName
            );
            
            return result;
        } catch (Exception ex) {
            // Log de error
            log.error("!!! Service Method: {}.{} | Exception: {} | Message: {}",
                className,
                methodName,
                ex.getClass().getSimpleName(),
                ex.getMessage()
            );
            
            throw ex;
        }
    }
    
    /**
     * Logging de excepciones
     */
    @AfterThrowing(pointcut = "execution(* com.uci.competencia..*.*(..))", throwing = "ex")
    public void logException(JoinPoint joinPoint, Exception ex) {
        String methodSignature = joinPoint.getSignature().toShortString();
        
        log.error("EXCEPTION in {}: {}", methodSignature, ex.getMessage());
        
        // Log del stack trace solo para errores graves
        if (isGraveException(ex)) {
            log.error("Stack trace:", ex);
        }
    }
    
    /**
     * Determina si la excepción es "grave" (requiere stack trace)
     */
    private boolean isGraveException(Exception ex) {
        return ex instanceof NullPointerException ||
               ex instanceof IllegalArgumentException ||
               ex instanceof RuntimeException;
    }
    
    /**
     * Serializa argumentos para logging
     */
    private String serializeArguments(Object[] args) {
        if (args == null || args.length == 0) {
            return "[]";
        }
        
        try {
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < Math.min(args.length, 5); i++) {  // Máx 5 args
                if (i > 0) sb.append(", ");
                Object arg = args[i];
                
                if (arg == null) {
                    sb.append("null");
                } else if (arg instanceof String) {
                    sb.append("\"").append(arg).append("\"");
                } else if (isComplexObject(arg)) {
                    sb.append(arg.getClass().getSimpleName()).append("{...}");
                } else {
                    sb.append(arg);
                }
            }
            sb.append("]");
            return sb.toString();
        } catch (Exception ex) {
            log.warn("Error serializing arguments", ex);
            return "[error-serializing]";
        }
    }
    
    /**
     * Serializa resultado para logging
     */
    private String serializeResult(Object result) {
        if (result == null) {
            return "null";
        }
        
        if (result instanceof String) {
            String str = (String) result;
            return str.length() > 100 ? str.substring(0, 100) + "..." : str;
        }
        
        if (isComplexObject(result)) {
            return result.getClass().getSimpleName() + "{...}";
        }
        
        return result.toString();
    }
    
    /**
     * Determina si es un objeto complejo (DTO, Entity, etc)
     */
    private boolean isComplexObject(Object obj) {
        return obj.getClass().getPackage().getName().startsWith("com.uci.competencia");
    }
}
