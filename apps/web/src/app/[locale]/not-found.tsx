import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-gray-50">
      <div className="text-center px-4">
        <h1 className="text-6xl md:text-8xl font-bold text-medical-blue mb-4">
          404
        </h1>
        <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-4">
          Page Not Found
        </h2>
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          The page you are looking for might have been removed, had its name
          changed, or is temporarily unavailable.
        </p>
        <Link href="/">
          <Button variant="default">
            Go Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
