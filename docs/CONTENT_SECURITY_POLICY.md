# Content-Security-Policy (CSP) - Configuración de Seguridad

## Resumen
Se ha configurado la cabecera **Content-Security-Policy** en ambos servidores para proteger contra ataques como:
- XSS (Cross-Site Scripting)
- Inyección de código
- Clickjacking
- Robo de datos

## Configuración Frontend (Next.js)

**Archivo**: `next.config.mjs`

La cabecera se establece a través de middleware HTTP con la siguiente política:

```
default-src 'self'
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.vercel-insights.com https://vercel.live https://static.cloudflareinsights.com
style-src 'self' 'unsafe-inline'
img-src 'self' data: https: blob:
font-src 'self' data:
connect-src 'self' https: wss: ws: http://localhost:* http://127.0.0.1:*
frame-ancestors 'self'
form-action 'self'
base-uri 'self'
```

### Directivas permitidas:
- **script-src**: Scripts del mismo origen + Vercel Analytics
- **style-src**: Estilos inline para frameworks CSS-in-JS
- **img-src**: Imágenes locales y externas (data URIs, blobs)
- **connect-src**: API calls al backend, WebSockets
- **frame-ancestors**: Solo puede ser embebido en el mismo origen

## Configuración Backend (Spring Boot)

**Archivo**: `backend/src/main/java/com/uci/competencia/security/SecurityHeadersFilter.java`

Filtro servlet que añade cabeceras de seguridad a todas las respuestas HTTP:

```java
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; ...
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### Cabeceras de seguridad adicionales:
- **X-Content-Type-Options**: Previene MIME-type sniffing
- **X-Frame-Options**: Previene clickjacking
- **X-XSS-Protection**: Protección adicional contra XSS
- **Strict-Transport-Security**: Fuerza HTTPS (1 año)
- **Referrer-Policy**: Controla información de referencia
- **Permissions-Policy**: Desactiva características peligrosas

## Integración con SecurityConfig

El filtro `SecurityHeadersFilter` se ejecuta **primero** en la cadena de filtros (antes de JWT):

```java
.addFilterBefore(securityHeadersFilter, UsernamePasswordAuthenticationFilter.class)
```

## Verificación

### Verificar en navegador (Chrome/Firefox DevTools):
1. Abrir herramientas de desarrollador (F12)
2. Ir a pestaña **Network**
3. Hacer una petición (reload página)
4. Ver cabeceras de respuesta → buscar "Content-Security-Policy"

### Verificar con curl:
```bash
# Frontend
curl -I https://tu-dominio.com
# Buscar: Content-Security-Policy

# Backend
curl -I https://tu-dominio.com/api/health
# Buscar: Content-Security-Policy
```

## Configuración por Entorno

Para desarrollo vs producción, puedes parametrizar la política:

### Application.yml (Spring Boot):
```yaml
security:
  csp:
    # Desarrollo: más permisivo
    dev: "default-src 'self' 'unsafe-inline' 'unsafe-eval'"
    # Producción: más restrictivo
    prod: "default-src 'self'"
```

### Next.config.mjs:
```javascript
const { NODE_ENV } = process.env
const cspPolicy = NODE_ENV === 'production' 
  ? "default-src 'self'" 
  : "default-src 'self' 'unsafe-inline'"
```

## Notas Importantes

⚠️ **'unsafe-inline' y 'unsafe-eval'**: Se incluyen para desarrollo. En producción, considera:
- Usar nonces o hashes para scripts inline
- Implementar Service Workers
- Usar content security policy violations reporting

🔒 **HTTPS en Producción**: La política incluye `upgrade-insecure-requests` para forzar HTTPS automáticamente.

📋 **Monitoreo**: Considera añadir `report-uri` o `report-to` para recibir reportes de violaciones CSP:
```
report-uri https://tu-servicio-csp.com/report
```

## Referencias
- [MDN: Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy)
- [OWASP: Content Security Policy](https://owasp.org/www-community/attacks/xss/#content-security-policy)
- [CSP Validator](https://csp-evaluator.withgoogle.com/)
