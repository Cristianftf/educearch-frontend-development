package com.uci.competencia.aspect;

import io.micrometer.core.instrument.*;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

/**
 * Aspecto AOP para medir rendimiento de métodos de servicio
 * 
 * Responsable de:
 * - Medir latencia de servicios
 * - Registrar errores con Micrometer
 * - Trackear SLA (Service Level Agreements)
 * - Colectar métricas para Prometheus
 */
@Aspect
@Component
@Slf4j
public class PerformanceAspect {
    
    private final MeterRegistry meterRegistry;
    
    public PerformanceAspect(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }
    
    /**
     * Mide el tiempo de ejecución de todos los servicios
     */
    @Around("execution(* com.uci.competencia.service..*.*(..))")
    public Object measureServicePerformance(ProceedingJoinPoint joinPoint) throws Throwable {
        String className = joinPoint.getSignature().getDeclaringType().getSimpleName();
        String methodName = joinPoint.getSignature().getName();
        String metricName = String.format("service.%s.%s", className, methodName);
        
        long startTime = System.currentTimeMillis();
        Timer.Sample timerSample = Timer.start(meterRegistry);
        
        try {
            Object result = joinPoint.proceed();
            
            // Registrar éxito
            recordSuccess(timerSample, metricName, className, methodName);
            
            return result;
        } catch (Exception ex) {
            // Registrar error
            recordError(timerSample, metricName, className, methodName, ex);
            throw ex;
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            logPerformance(className, methodName, duration);
        }
    }
    
    /**
     * Mide el tiempo de ejecución de controladores
     */
    @Around("execution(* com.uci.competencia.controller.api..*.*(..))")
    public Object measureControllerPerformance(ProceedingJoinPoint joinPoint) throws Throwable {
        String className = joinPoint.getSignature().getDeclaringType().getSimpleName();
        String methodName = joinPoint.getSignature().getName();
        String metricName = String.format("http.request.%s.%s", className, methodName);
        
        Timer.Sample sample = Timer.start(meterRegistry);
        long startTime = System.currentTimeMillis();
        
        try {
            Object result = joinPoint.proceed();
            sample.stop(Timer.builder(metricName)
                .description("HTTP request latency for " + methodName)
                .publishPercentiles(0.5, 0.95, 0.99)
                .register(meterRegistry));
            
            return result;
        } catch (Exception ex) {
            Counter.builder("http.request.error")
                .tag("controller", className)
                .tag("method", methodName)
                .tag("exception", ex.getClass().getSimpleName())
                .register(meterRegistry)
                .increment();
            
            throw ex;
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            if (duration > 3000) {
                log.warn("Controller {} took {}ms (SLOW)", metricName, duration);
            }
        }
    }
    
    /**
     * Registra métrica de éxito
     */
    private void recordSuccess(Timer.Sample sample, String metricName, 
                              String className, String methodName) {
        sample.stop(Timer.builder(metricName)
            .description("Service method latency")
            .tag("status", "success")
            .tag("class", className)
            .tag("method", methodName)
            .publishPercentiles(0.5, 0.95, 0.99)
            // SLA en ms: 100ms (ideal), 500ms (bueno), 1000ms (aceptable)
            .register(meterRegistry));
        
        Counter.builder("service.invocation.success")
            .tag("class", className)
            .tag("method", methodName)
            .register(meterRegistry)
            .increment();
    }
    
    /**
     * Registra métrica de error
     */
    private void recordError(Timer.Sample sample, String metricName,
                            String className, String methodName, Exception ex) {
        sample.stop(Timer.builder(metricName)
            .description("Service method latency")
            .tag("status", "error")
            .tag("class", className)
            .tag("method", methodName)
            .tag("exception", ex.getClass().getSimpleName())
            .register(meterRegistry));
        
        Counter.builder("service.invocation.error")
            .tag("class", className)
            .tag("method", methodName)
            .tag("exception", ex.getClass().getSimpleName())
            .register(meterRegistry)
            .increment();
    }
    
    /**
     * Log de información de rendimiento
     */
    private void logPerformance(String className, String methodName, long duration) {
        if (duration > 5000) {
            log.warn("SLOW: {}.{} took {}ms", className, methodName, duration);
        } else if (duration > 1000) {
            log.debug("MODERATE: {}.{} took {}ms", className, methodName, duration);
        }
    }
}
