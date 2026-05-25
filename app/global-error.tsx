"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div style={{ textAlign: "center", maxWidth: "28rem" }}>
            <h1
              style={{
                fontSize: "3.75rem",
                fontWeight: 700,
                color: "#dc2626",
                margin: 0,
              }}
            >
              Error Crítico
            </h1>
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: 600,
                margin: "1rem 0 0.5rem",
              }}
            >
              Algo salió muy mal
            </h2>
            <p
              style={{
                color: "#6b7280",
                lineHeight: 1.5,
                margin: "0 0 1.5rem",
              }}
            >
              Ha ocurrido un error crítico en la aplicación. Nuestro equipo ha
              sido notificado automáticamente.
            </p>
            <button
              onClick={reset}
              style={{
                padding: "0.75rem 1.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "white",
                backgroundColor: "#2563eb",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
                marginRight: "0.75rem",
              }}
            >
              Intentar de nuevo
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              style={{
                padding: "0.75rem 1.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#374151",
                backgroundColor: "transparent",
                border: "1px solid #d1d5db",
                borderRadius: "0.375rem",
                cursor: "pointer",
              }}
            >
              Ir al inicio
            </button>
            <p
              style={{
                marginTop: "2rem",
                fontSize: "0.75rem",
                color: "#9ca3af",
              }}
            >
              Si el problema persiste, contacta al administrador del sistema.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}