import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Explorer from "@/pages/Explorer";
import Saved from "@/pages/Saved";
import Drafts from "@/pages/Drafts";
import DraftEditor from "@/pages/DraftEditor";
import Applications from "@/pages/Applications";
import BusinessOpportunities from "@/pages/BusinessOpportunities";
import StartupProfile from "@/pages/StartupProfile";
import Settings from "@/pages/Settings";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/auth/Login";
import Signup from "@/pages/auth/Signup";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import OnboardingProfile from "@/pages/auth/OnboardingProfile";
import OnboardingReview from "@/pages/auth/OnboardingReview";
import OpportunityDetails from "@/pages/OpportunityDetails";


function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/onboarding/profile" element={<ProtectedRoute><OnboardingProfile /></ProtectedRoute>} />
          <Route path="/onboarding/review" element={<ProtectedRoute><OnboardingReview /></ProtectedRoute>} />
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/explorer" element={<Explorer />} />
            <Route path="/explorer/:id" element={<OpportunityDetails />} />

            <Route path="/saved" element={<Saved />} />
            <Route path="/drafts" element={<Drafts />} />
            <Route path="/drafts/:id" element={<DraftEditor />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/business" element={<BusinessOpportunities />} />
            <Route path="/profile" element={<StartupProfile />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
