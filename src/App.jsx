import React from "react";
import { Route, Routes } from "react-router-dom";
import Home from "./pages/home/Home";
import Register from "./pages/register/Register";
import VerificationCode from "./pages/verificationCode/VerificationCode";
import AccountActivation from "./pages/accountActivation/AccountActivation";
import CreateProfile from "./pages/createProfile/CreateProfile";
import ProfileVerification from "./pages/profileVerification/ProfileVerification";

const App = () => {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sign-up" element={<Register />} />
        <Route path="/verification-code" element={<VerificationCode />} />
        <Route path="/account-activation" element={<AccountActivation />} />
        <Route path="/create-profile" element={<CreateProfile />} />
        <Route path="/profile-verified" element={<ProfileVerification />} />
      </Routes>
    </>
  );
};

export default App;
