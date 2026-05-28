import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Overview from "./pages/Overview";
import Routing from "./pages/Routing";
import Cache from "./pages/Cache";
import Budgets from "./pages/Budgets";
import Forecasting from "./pages/Forecasting";
import Recommendations from "./pages/Recommendations";
import Providers from "./pages/Providers";
import Actions from "./pages/Actions";
import OptimizationLog from "./pages/OptimizationLog";
import TipeAnalyzer from "./pages/TipeAnalyzer";
import AdvisorTools from "./pages/AdvisorTools";
import Playground from "./pages/Playground";
import Guide from "./pages/Guide";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Settings from "./pages/Settings";
import CommandPalette from "./components/CommandPalette";
import Chatbot from "./components/Chatbot";
import ProtectedRoute from "./components/ProtectedRoute";
import { OrgProvider } from "./lib/OrgContext";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import { Toaster } from "sonner";

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  return (
    <AuthProvider>
      <OrgProvider>
        <BrowserRouter>
          <Toaster theme="dark" position="bottom-right" />
          <Routes>
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
            <Route
              element={
                <ProtectedRoute>
                  <>
                    <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
                    <Chatbot />
                    <Layout onPaletteOpen={() => setPaletteOpen(true)} />
                  </>
                </ProtectedRoute>
              }
            >
              <Route index element={<Overview />} />
              <Route path="/routing" element={<Routing />} />
              <Route path="/cache" element={<Cache />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/forecasting" element={<Forecasting />} />
              <Route path="/recommendations" element={<Recommendations />} />
              <Route path="/providers" element={<Providers />} />
              <Route path="/actions" element={<Actions />} />
              <Route path="/optimization" element={<OptimizationLog />} />
              <Route path="/tipe" element={<TipeAnalyzer />} />
              <Route path="/advisor" element={<AdvisorTools />} />
              <Route path="/playground" element={<Playground />} />
              <Route path="/guide" element={<Guide />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </OrgProvider>
    </AuthProvider>
  );
}

export default App;
