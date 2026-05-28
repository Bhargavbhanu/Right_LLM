import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-500 text-sm" data-testid="auth-loading">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-zinc-700 border-t-zinc-200 animate-spin" />
          Checking session…
        </div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  if (requireAdmin && user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-400 text-sm" data-testid="auth-forbidden">
        <div className="text-center">
          <div className="font-heading text-lg text-zinc-100 mb-2">Admin only</div>
          <div className="text-xs">You need the admin role to access this page.</div>
        </div>
      </div>
    );
  }
  return children;
}
