# Seguridad de Datos Confidenciales: CORS e IP Whitelist

## Resumen Ejecutivo

Se ha implementado una estrategia multicapa para proteger datos confidenciales:
1. **CORS Restrictivo**: Solo dominios permitidos pueden acceder
2. **IP Whitelist**: Endpoints sensibles solo accesibles desde IPs autorizadas
3. **Autenticación Obligatoria**: Endpoints administrativos requieren rol ADMIN
4. **Protección de Documentación**: Swagger/API docs solo para administradores

---

## 1. Configuración CORS Restrictiva

### Problema Original
```
❌ Permitía: http://*.tunnelmole.net (comodín muy permisivo)
❌ Permitía: Todos los encabezados (*) 
❌ Acceso desde cualquier origen
```

### Solución Implementada
```
✅ CORS solo para dominios específicos
✅ Headers limitados (Authorization, Content-Type)
✅ Credenciales controladas
✅ Métodos HTTP limitados
```

### Archivo: `CorsSecurityConfig.java`
```java
security.cors.allowed-origins[0]=http://localhost:3000
security.cors.allowed-methods[0]=GET
security.cors.allowed-headers[0]=Authorization
```

### Por Entorno

#### Desarrollo (Dev)
**Archivo**: `application-dev.properties`
- ✅ Permite localhost y tunnelmole (desarrollo local)
- ✅ Logging DEBUG para troubleshooting
- ✅ IPs de localhost permitidas

```properties
security.cors.allowed-origins[0]=http://localhost:3000
security.cors.allowed-origins[3]=https://*.tunnelmole.net
security.ip.whitelist=127.0.0.1,::1,localhost
```

#### Producción (Prod)
**Archivo**: `application-prod.properties`
- ✅ SOLO frontend.uci.cu permitido
- ✅ SSL/TLS obligatorio
- ✅ Cookies seguras (Secure, HttpOnly, SameSite=strict)
- ✅ IPs restrictivas (solo infraestructura interna)

```properties
security.cors.allowed-origins[0]=https://frontend.uci.cu
security.ip.whitelist=10.0.0.0,10.0.0.1,10.0.0.2
server.ssl.enabled=true
server.servlet.session.cookie.secure=true
```

---

## 2. IP Whitelist para Datos Sensibles

### Filtro: `IpWhitelistFilter.java`

Valida IPs de cliente antes de permitir acceso a endpoints sensibles.

### Endpoints Protegidos por IP
```
❌ /api/admin/**           → Solo IPs autorizadas
❌ /api/metrics/**         → Solo IPs autorizadas
❌ /swagger-ui/**          → Solo IPs autorizadas
❌ /v3/api-docs/**         → Solo IPs autorizadas
❌ /actuator/**            → Solo IPs autorizadas
❌ /api/health/**          → Solo IPs autorizadas
```

### Flujo de Validación

```
1. Cliente realiza request
            ↓
2. IpWhitelistFilter intercepta
            ↓
3. ¿Es endpoint sensible?
   ├─ SÍ: ¿IP en whitelist?
   │  ├─ SÍ: Continuar ✅
   │  └─ NO: Rechazar (403 Forbidden) ❌
   └─ NO: Continuar (pero requiere autenticación)
```

### Consideración de Proxies

El filtro detecta IP real considerando:
```
1. X-Forwarded-For header (proxies múltiples)
2. X-Real-IP header (nginx, Apache)
3. RemoteAddr (conexión directa)
```

### Configuración de IP Whitelist

**Production**:
```properties
# Solo servidores internos
security.ip.whitelist=10.0.0.0,10.0.0.1,10.0.0.2
```

**Development**:
```properties
# Incluir máquina local y desarrollo
security.ip.whitelist=127.0.0.1,::1,localhost
```

---

## 3. Protección de Endpoints en SecurityConfig

### Cambios Principales

**Antes** (Inseguro):
```java
.requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
.requestMatchers("/api/health", "/api/metrics/**").permitAll()
❌ Permitía acceso sin autenticación
```

**Después** (Seguro):
```java
.requestMatchers("/swagger-ui/**", "/v3/api-docs/**").hasRole("ADMIN")
.requestMatchers("/api/health", "/api/metrics/**").hasRole("ADMIN")
✅ Requiere rol ADMIN + validación de IP
```

### Matriz de Autorización

| Endpoint | Público | Autenticado | Admin | IP Required |
|----------|---------|-------------|-------|------------|
| `/api/auth/**` | ✅ | - | - | ❌ |
| `/api/student/**` | ❌ | ✅ (STUDENT) | - | ❌ |
| `/api/professor/**` | ❌ | ✅ (PROFESSOR) | - | ❌ |
| `/api/admin/**` | ❌ | ❌ | ✅ | ✅ |
| `/swagger-ui/**` | ❌ | ❌ | ✅ | ✅ |
| `/api/health` | ❌ | ❌ | ✅ | ✅ |
| `/api/metrics/**` | ❌ | ❌ | ✅ | ✅ |

---

## 4. Validación en Tiempo Real

### Verificar CORS Response Headers

```bash
# Frontend puede: Comprobar si recibe Access-Control-Allow-Origin
curl -I -H "Origin: http://localhost:3000" \
  https://backend.uci.cu/api/auth/login

# Response esperada:
# Access-Control-Allow-Origin: http://localhost:3000

# Si origen NO está en whitelist:
# (vacío - rechazado por navegador)
```

### Verificar IP Whitelist

```bash
# Desde IP NO autorizada (debería fallar):
curl -H "Authorization: Bearer $TOKEN" \
  https://backend.uci.cu/swagger-ui/index.html
# Response: 403 Forbidden

# Desde localhost (autorizada):
curl -H "Authorization: Bearer $TOKEN" \
  -H "X-Forwarded-For: 127.0.0.1" \
  https://backend.uci.cu/swagger-ui/index.html
# Response: 200 OK
```

---

## 5. Configuración de Headers CORS Específicos

| Header | Valor | Propósito |
|--------|-------|----------|
| Access-Control-Allow-Origin | `https://frontend.uci.cu` | Dominios permitidos |
| Access-Control-Allow-Methods | `GET, POST, PUT, DELETE, OPTIONS` | Métodos HTTP permitidos |
| Access-Control-Allow-Headers | `Authorization, Content-Type` | Headers que cliente puede enviar |
| Access-Control-Allow-Credentials | `true` | Permitir cookies/credenciales |
| Access-Control-Max-Age | `3600` | Cache de preflight (1 hora) |

---

## 6. Guía de Implantación por Ambiente

### Local (Desarrollo)

```bash
# Iniciar con perfil dev
java -jar application.jar --spring.profiles.active=dev

# Se permite:
# - localhost:3000, localhost:3001
# - tunnelmole.net (para testing remoto)
# - Swagger UI accesible desde 127.0.0.1
```

### Staging

```bash
# Perfil intermedio (similar a prod pero menos estricto)
# Crear: application-staging.properties
security.cors.allowed-origins[0]=https://staging-frontend.uci.cu
security.ip.whitelist=10.0.1.0,10.0.1.1
```

### Producción

```bash
# Iniciar con perfil prod + variables de entorno
java -jar application.jar \
  --spring.profiles.active=prod \
  --SSL_KEYSTORE_PATH=/etc/ssl/certs/keystore.p12 \
  --SSL_KEYSTORE_PASSWORD=${KEYSTORE_PASSWORD}

# Se permite SOLO:
# - frontend.uci.cu (HTTPS)
# - IPs internas autorizadas
# - Swagger UI completamente deshabilitado
```

---

## 7. Política del Mismo Origen (SOP) - Beneficios

Con esta configuración, el navegador aplica SOP automáticamente:

### Protegido Contra:
```
❌ XSS desde sitios malintencionados
❌ CSRF attacks (mitigado por SOP + CORS)
❌ Data exfiltration hacia terceros
❌ Session hijacking desde orígenes no autorizados
```

### Ejemplo de Rechazo:
```javascript
// Sitio: https://malicious-domain.com
fetch('https://backend.uci.cu/api/admin/users', {
  method: 'GET',
  credentials: 'include'
})
// ❌ RECHAZADO por navegador
// El servidor nunca ni procesa la request
// Error: CORS policy: Access denied
```

---

## 8. Troubleshooting

### Error: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Causa**: Origen no está en whitelist
**Solución**: 
1. Verificar nombre de dominio exacto
2. Añadir a `allowed-origins` en `application.properties`
3. O cambiar a configuración específica por ambiente

### Error: "403 Forbidden" en `/api/admin`

**Causa 1**: IP no está en whitelist
```bash
# Verificar IP actual
curl https://api.ipify.org?format=json

# Añadir a security.ip.whitelist
```

**Causa 2**: Token JWT inválido/expirado
```bash
# Verificar token
curl -H "Authorization: Bearer $TOKEN" \
  https://backend.uci.cu/api/admin/health
```

### Error: "Swagger UI not accessible"

**En Producción**: Completamente deshabilitado - esperado
**En Desarrollo**: Verificar:
```bash
# 1. Está en localhost o IP autorizada?
curl -I http://localhost:8080/swagger-ui/index.html

# 2. Token ADMIN presente?
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8080/swagger-ui/index.html
```

---

## 9. Mejora Futura: Report-URI para CORS Violations

Para monitorear intentos de ataque:

```java
configuration.setUriVariablesHandler(uri -> {
    return "https://reporting.uci.cu/cors-report";
});
```

Configurar endpoint que recolecte reportes CORS.

---

## 10. Checklist de Seguridad

- [x] CORS limitado a dominios permitidos
- [x] Headers CORS restrictivos
- [x] IP Whitelist en endpoints sensibles
- [x] Swagger/API Docs protegidos
- [x] Métricas protegidas (ADMIN + IP)
- [x] Configuración por ambiente (dev/prod)
- [x] SSL/TLS en producción
- [x] Cookies seguras (HttpOnly, Secure, SameSite)
- [ ] Deshabilitar endpoints de debug en prod
- [ ] Monitorear violaciones CORS/IP
- [ ] Revisar logs regularmente

---

## 11. Referencias

- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [OWASP: Cross-Origin Resource Sharing](https://owasp.org/www-community/attacks/csrf)
- [Spring Security: CORS](https://spring.io/guides/gs/rest-service-cors/)
- [PortSwigger: SOP](https://portswigger.net/web-security/cors/same-origin-policy)
