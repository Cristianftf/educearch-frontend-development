# Resumen de Cambios de Seguridad

## 🔒 Implementación: Protección de Datos Confidenciales

**Fecha**: 6 de mayo de 2026
**Objetivo**: Proteger datos confidenciales mediante CORS restrictivo, IP Whitelist y autenticación obligatoria

---

## Cambios Implementados

### 1. **Backend - Nuevos Filtros de Seguridad**

#### `IpWhitelistFilter.java` (NUEVO)
- Valida IPs de clientes para endpoints sensibles
- Detecta IP real considerando proxies (X-Forwarded-For, X-Real-IP)
- Bloquea acceso no autorizado con 403 Forbidden
- **Endpoints protegidos**: `/api/admin/**`, `/swagger-ui/**`, `/api/metrics/**`, `/actuator/**`

#### `CorsSecurityConfig.java` (NUEVO)
- Configuración centralizada de CORS por propiedades
- Reemplaza valores hardcodeados con configuración flexible
- Permite diferentes políticas por entorno (dev/prod)

### 2. **Backend - Actualización de Seguridad**

#### `SecurityConfig.java` (MODIFICADO)
```java
// Antes: Endpoints públicos sin protección
.requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()

// Después: Endpoints protegidos con rol ADMIN + validación de IP
.requestMatchers("/swagger-ui/**", "/v3/api-docs/**").hasRole("ADMIN")
```

**Orden de filtros actualizado**:
1. `IpWhitelistFilter` - Valida IP primero
2. `SecurityHeadersFilter` - Añade headers de seguridad
3. `JwtAuthenticationFilter` - Valida JWT token

### 3. **Configuración - Arquivos de Propiedades**

#### `application.properties` (MODIFICADO)
- ✅ Configuración CORS más restrictiva por defecto
- ✅ Añadido IP whitelist: `127.0.0.1, ::1, localhost`
- ✅ Mapeo de dominios CORS limitado
- ✅ Credenciales sensibles documentadas (deben ir en variables de entorno)

#### `application-dev.properties` (NUEVO)
- Perfil para desarrollo local
- Permite tunnelmole para testing remoto
- Logging DEBUG para troubleshooting
- IP whitelist incluye localhost

#### `application-prod.properties` (NUEVO)
- Perfil para producción
- CORS SOLO `https://frontend.uci.cu`
- IP whitelist restrictiva: `10.0.0.x` (red interna)
- SSL/TLS obligatorio
- Cookies seguras: `Secure`, `HttpOnly`, `SameSite=strict`
- Swagger UI deshabilitado
- Logging WARN (no DEBUG)

### 4. **Documentación Completa**

#### `docs/CORS_AND_IP_WHITELIST_SECURITY.md` (NUEVO)
- Explicación detallada de cambios
- Matriz de autorización por endpoint
- Flujo de validación de IP
- Ejemplos de curl para testing
- Troubleshooting de errores comunes
- Configuración por ambiente

#### `docs/PRODUCTION_SECURITY_CONFIG.md` (NUEVO)
- Guía específica para producción
- Variables de entorno recomendadas
- Docker Compose y Kubernetes examples
- Configuración Nginx con security headers
- Rate limiting y monitoreo
- Checklist de despliegue
- Procedures para incidentes

---

## Matriz de Cambios Antes/Después

| Aspecto | Antes | Después |
|--------|------|---------|
| **CORS** | `*.tunnelmole.net` (muy permisivo) | Dominios específicos por ambiente |
| **Headers CORS** | `*` (todos) | Solo `Authorization`, `Content-Type` |
| **Swagger UI** | Público (`.permitAll()`) | Solo ADMIN + IP whitelist |
| **API Metrics** | Público | Solo ADMIN + IP whitelist |
| **Health Check** | Público | Solo ADMIN + IP whitelist |
| **Admin Endpoints** | Sin protección IP | Requiere IP autorizada |
| **Documentación API** | Pública | Solo ADMIN + IP whitelist |
| **SSL/TLS** | Opcional | Obligatorio en prod |
| **Cookies Seguras** | No configuradas | `Secure`, `HttpOnly`, `SameSite=strict` |
| **Configuración** | Hardcodeada | Por propiedades + perfiles (dev/prod) |

---

## Endpoints Protegidos

### Nivel 1: Público (sin autenticación)
```
✅ POST /api/auth/login
✅ POST /api/auth/register
✅ POST /api/auth/refresh-token
✅ GET /error
```

### Nivel 2: Autenticado (JWT + Rol)
```
✅ GET /api/search/**          (STUDENT, PROFESSOR)
✅ GET /api/verify/**          (STUDENT, PROFESSOR)
✅ GET /api/chat/**            (STUDENT, PROFESSOR, ADMIN)
✅ GET /api/student/**         (STUDENT)
✅ GET /api/professor/**       (PROFESSOR)
✅ GET /api/admin/**           (ADMIN)
```

### Nivel 3: Admin + IP Whitelist (máxima protección)
```
🔒 GET /swagger-ui/**          (ADMIN + IP autorizada)
🔒 GET /v3/api-docs/**         (ADMIN + IP autorizada)
🔒 GET /api/health/**          (ADMIN + IP autorizada)
🔒 GET /api/metrics/**         (ADMIN + IP autorizada)
```

---

## Testing de Cambios

### 1. Verificar CORS Funciona

```bash
# Frontend en localhost:3000 debería funcionar
curl -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  http://localhost:8080/api/search

# Frontend en otro origen debería ser rechazado
curl -H "Origin: https://attacker.com" \
  http://localhost:8080/api/search
# Error: CORS policy violation
```

### 2. Verificar IP Whitelist en Desarrollo

```bash
# Acceso a Swagger desde localhost debería funcionar
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8080/swagger-ui/index.html
# ✅ 200 OK

# Acceso desde IP no en whitelist debería ser rechazado
# (Simular con X-Forwarded-For)
curl -H "X-Forwarded-For: 203.0.113.45" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8080/swagger-ui/index.html
# ❌ 403 Forbidden
```

### 3. Verificar en Producción

```bash
# Activar perfil prod
export SPRING_PROFILES_ACTIVE=prod

# CORS solo debería permitir frontend.uci.cu
# Swagger UI no debería existir (deshabilitado en propiedades)
# Las IPs solo deberían ser las autorizadas
```

---

## Variables de Entorno por Ambiente

### Desarrollo
```bash
SPRING_PROFILES_ACTIVE=dev
SECURITY_IP_WHITELIST=127.0.0.1,::1,localhost
SECURITY_CORS_ALLOWED_ORIGINS_0=http://localhost:3000
SECURITY_CORS_ALLOWED_ORIGINS_1=https://*.tunnelmole.net
```

### Producción
```bash
SPRING_PROFILES_ACTIVE=prod
SECURITY_IP_WHITELIST=10.0.0.1,10.0.0.2,10.0.1.1
SECURITY_CORS_ALLOWED_ORIGINS_0=https://frontend.uci.cu
SSL_KEYSTORE_PATH=/etc/ssl/certs/keystore.p12
SSL_KEYSTORE_PASSWORD=${KEYSTORE_PASSWORD}
```

---

## Impacto en Operaciones

### ✅ Beneficios
- 🔐 Datos confidenciales solo accesibles por IPs autorizadas
- 🛡️ Reducción de superficie de ataque (CORS restrictivo)
- 🔑 Autenticación obligatoria para datos sensibles
- 📊 Mejor visibilidad (logs de intentos de acceso no autorizado)
- 🚀 Configuración flexible por ambiente

### ⚠️ Cambios Requeridos
- Actualizar IP whitelist en producción con IPs reales
- Configurar SSL/TLS en producción
- Revisar que las credenciales estén en variables de entorno
- Actualizar scripts de deployment

### 📋 Próximos Pasos
1. [ ] Validar cambios en ambiente de desarrollo
2. [ ] Configurar IPs correctas para staging
3. [ ] Obtener certificado SSL/TLS para producción
4. [ ] Montar infraestructura de seguridad (nginx, WAF)
5. [ ] Entrenar al equipo en nuevas políticas
6. [ ] Implementar monitoreo de violaciones de seguridad
7. [ ] Realizar security audit post-deployment

---

## Archivos Modificados

### Nuevos
```
✨ backend/src/main/java/com/uci/competencia/security/IpWhitelistFilter.java
✨ backend/src/main/java/com/uci/competencia/config/CorsSecurityConfig.java
✨ backend/src/main/resources/application-dev.properties
✨ backend/src/main/resources/application-prod.properties
✨ docs/CORS_AND_IP_WHITELIST_SECURITY.md
✨ docs/PRODUCTION_SECURITY_CONFIG.md
```

### Modificados
```
📝 backend/src/main/java/com/uci/competencia/config/SecurityConfig.java
📝 backend/src/main/resources/application.properties
```

---

## Referencia de Seguridad

- **OWASP**: https://owasp.org/
- **CWE-601**: URL Redirection to Untrusted Site
- **CWE-434**: Unrestricted Upload of File with Dangerous Type
- **RFC 7231**: HTTP/1.1 Semantics (CORS related)

---

**Autor**: GitHub Copilot AI  
**Versión**: 1.0  
**Estado**: ✅ Implementado
