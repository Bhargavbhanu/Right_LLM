import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import { Toaster } from "sonner";

function App() {
  return (
    <BrowserRouter>
      <Toaster theme="dark" position="bottom-right" />
      <Routes>
        <Route element={<Layout />}>
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
