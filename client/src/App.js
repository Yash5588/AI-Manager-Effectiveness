import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ManagerDashboard from "./pages/ManagerDashboard";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          <Route path="/" element={<ManagerDashboard />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
