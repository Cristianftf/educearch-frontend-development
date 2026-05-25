"use client";

import { Button } from "@/components/ui/button";
import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application error:", {
      message: error.message,
      digest: error.digest,
      name: error.name,
    });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-destructive">Error</h1>
          <h2 className="text-2xl font-semibold text-foreground">
            Algo salió mal
          </h2>
          <p className="text-muted-foreground">
            Ha ocurrido un error inesperado. No te preocupes, hemos sido
            notificados y estamos trabajando en ello.
          </p>
          {process.env.NODE_ENV === "development" && (
            <p className="text-xs text-muted-foreground mt-2 font-mono bg-muted p-2 rounded">
              {error.message}
              {error.digest && <> | Digest: {error.digest}</>}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset} variant="default">
            Intentar de nuevo
          </Button>
          <Button
            onClick={() => (window.location.href = "/")}
            variant="outline"
          >
            Ir al inicio
          </Button>
        </div>

        <div className="pt-4 text-xs text-muted-foreground">
          <p>Si el problema persiste, contacta al administrador del sistema.</p>
        </div>
      </div>
    </div>
  );
}