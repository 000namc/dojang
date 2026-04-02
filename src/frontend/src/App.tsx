import { Routes, Route, Navigate } from "react-router-dom";
import Practice from "./pages/Practice";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Practice />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
