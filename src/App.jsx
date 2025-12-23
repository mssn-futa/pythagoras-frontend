import React from "react";
import { Route, Routes } from "react-router-dom";
import Home from "./pages/home/Home";
import Register from "./pages/register/Register";
import VerificationCode from "./pages/verificationCode/VerificationCode";
import AccountActivation from "./pages/accountActivation/AccountActivation";
import CreateProfile from "./pages/createProfile/CreateProfile";
import ProfileVerification from "./pages/profileVerification/ProfileVerification";
import Login from "./pages/login/Login";
import Layout from "./components/layout/Layout";
import Dawah from "./pages/dawah/Dawah";
import Academics from "./pages/academics/Academics";
import Empowerment from "./pages/empowerment/Empowerment";
import Profile from "./pages/profile/Profile";

const App = () => {
  return (
    <>
      <Routes>
        <Route path="/sign-up" element={<Register />} />
        <Route path="/sign-in" element={<Login />} />
        <Route path="/verification-code" element={<VerificationCode />} />
        <Route path="/account-activation" element={<AccountActivation />} />
        <Route path="/create-profile" element={<CreateProfile />} />
        <Route path="/profile-verified" element={<ProfileVerification />} />

        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="dawah" element={<Dawah />} />
          <Route path="academics" element={<Academics />} />
          <Route path="empowerment" element={<Empowerment />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </>
  );
};

export default App;
