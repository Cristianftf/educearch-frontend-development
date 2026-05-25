export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="relative inline-flex">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">
          Cargando...
        </p>
      </div>
    </div>
  );
}