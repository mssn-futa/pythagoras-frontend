import React from "react";
import { Route, Routes } from "react-router-dom";
import Home from "./pages/home/Home";
import Register from "./pages/register/Register";
import VerCode from "./pages/verCode/VerCode";
import AcctActivation from "./pages/acctActivation/AcctActivation";
import CreateProfile from "./pages/createProfile/CreateProfile";
import ProfileVer from "./pages/profileVer/ProfileVer";

const App = () => {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sign-up" element={<Register />} />
        <Route path="/verification-code" element={<VerCode />} />
        <Route path="/account-activated" element={<AcctActivation />} />
        <Route path="/create-profile" element={<CreateProfile />} />
        <Route path="/profile-verified" element={<ProfileVer />} />
      </Routes>
    </>
  );
};

export default App;
