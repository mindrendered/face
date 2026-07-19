import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-6 overflow-hidden z-1">
      <div className="mx-auto w-full max-w-[472px] text-center">
        <h1 className="mb-8 font-bold text-4xl tracking-tight">404</h1>

        <p className="mb-6 text-base text-muted-foreground sm:text-lg">
          The page may have been deleted or does not exist. Please check the
          URL is correct.
        </p>

        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-5 py-3.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
