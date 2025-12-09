import React, { useState } from "react";
import { Camera, X, Eye, EyeOff } from "lucide-react";
import bgImage from "/src/assets/imageOne.jpg";
import smallLogo from "/src/assets/imageOne.jpg";
import sideImage from "/src/assets/imageTen.png";

const CreateProfile = () => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    matricNumber: "",
    password: "",
    phoneNumber: "",
    faculty: "",
  });
  const [profileImage, setProfileImage] = useState(null);
  const [receiptFile, setReceiptFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState("");

  const getPasswordStrength = (password) => {
    if (!password) return "";
    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    const fairRegex = /^(?=.*[a-zA-Z])(?=.*\d).{6,}$/;

    if (strongRegex.test(password)) return "Strong";
    if (fairRegex.test(password)) return "Fair";
    return "Weak";
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    if (name === "password") {
      setPasswordStrength(getPasswordStrength(value));
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProfileImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleReceiptUpload = (e) => {
    const file = e.target.files[0];
    if (file) setReceiptFile(file);
  };

  const removeProfileImage = () => setProfileImage(null);

  const handleSubmit = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  const isFormValid = () =>
    formData.firstName &&
    formData.lastName &&
    formData.matricNumber &&
    formData.password &&
    formData.phoneNumber &&
    formData.faculty &&
    receiptFile;

  return (
    <div className="min-h-screen w-full relative bg-white lg:bg-none">
      <div
        className="hidden lg:flex relative z-10 min-h-screen items-center justify-center px-10 py-10"
        style={{
          backgroundImage: `url(${bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="w-full max-w-6xl bg-white/95 shadow-2xl rounded-2xl grid lg:grid-cols-2 border border-gray-200 overflow-hidden">
          <div className="p-12 flex flex-col justify-between bg-gradient-to-br from-[#2A742F] to-[#04AF43] text-white">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <img
                  src={smallLogo}
                  alt="logo"
                  className="h-10 w-10 object-contain rounded-full"
                />
                Pythagoras
              </h1>
              <h2 className="text-xl font-semibold leading-relaxed">
                Welcome back to the central hub of productivity
              </h2>
              <p className="text-white/90 text-base">
                Join thousands of Muslim students benefitting from a unified
                ecosystem for Da'wah and Academics every day.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 space-y-4">
              <div className="flex items-start gap-4">
                <img
                  src={sideImage}
                  alt="user"
                  className="h-12 w-12 rounded-full object-cover"
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">Abdulwarith Salman</h3>
                  <p className="text-sm text-white/80">
                    Product Manager at Pythagoras
                  </p>
                </div>
              </div>
              <p className="text-white/90 text-sm leading-relaxed italic">
                "Pythagoras has completely transformed how our team
                collaborates. Intuitive interface and powerful features make
                complex projects feel effortless."
              </p>
            </div>

            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-white/20">
              <div>
                <div className="text-3xl font-bold">50K+</div>
                <div className="text-sm text-white/80">Active Users</div>
              </div>
              <div>
                <div className="text-3xl font-bold">99.9%</div>
                <div className="text-sm text-white/80">Uptime</div>
              </div>
              <div>
                <div className="text-3xl font-bold">24/7</div>
                <div className="text-sm text-white/80">Support</div>
              </div>
            </div>
          </div>

          <div className="flex items-start justify-center p-8 bg-white">
            <div className="w-full max-w-md">
              <div className="space-y-1 mb-5">
                <h2 className="text-2xl font-semibold text-[#000]">
                  Create Profile
                </h2>
                <p className="text-sm text-[#4B5563]">
                  Complete your profile to get started
                </p>
              </div>

              <div className="flex justify-center mb-5">
                <div className="relative">
                  {profileImage ? (
                    <div className="relative">
                      <img
                        src={profileImage}
                        alt="profile"
                        className="w-24 h-24 rounded-full object-cover border-4 border-[#2A742F]"
                      />
                      <button
                        onClick={removeProfileImage}
                        className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-all"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="w-24 h-24 rounded-full bg-gradient-to-br from-[#2A742F] to-[#04AF43] flex items-center justify-center cursor-pointer hover:opacity-90 transition-all">
                      <Camera className="text-white" size={32} />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  name="firstName"
                  placeholder="First Name"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#2A742F] focus:border-[#2A742F] focus:outline-none transition-all"
                />
                <input
                  type="text"
                  name="lastName"
                  placeholder="Last Name"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#2A742F] focus:border-[#2A742F] focus:outline-none transition-all"
                />
                <input
                  type="text"
                  name="matricNumber"
                  placeholder="Matric Number"
                  value={formData.matricNumber}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#2A742F] focus:border-[#2A742F] focus:outline-none transition-all"
                />
                <div className="relative w-full">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#2A742F] focus:border-[#2A742F] focus:outline-none transition-all pr-10"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-gray-500 focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <input
                  type="tel"
                  name="phoneNumber"
                  placeholder="Phone Number"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#2A742F] focus:border-[#2A742F] focus:outline-none transition-all"
                />
                <select
                  name="faculty"
                  value={formData.faculty}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#2A742F] focus:border-[#2A742F] focus:outline-none transition-all text-gray-700"
                >
                  <option value="">Select Faculty</option>
                  <option value="engineering">Engineering</option>
                  <option value="science">Science</option>
                  <option value="arts">Arts</option>
                  <option value="social-sciences">Social Sciences</option>
                  <option value="medicine">Medicine</option>
                  <option value="law">Law</option>
                </select>
              </div>

              <div className="space-y-2 mt-3">
                <label className="text-sm font-medium text-[#4B5563]">
                  School Fees Receipt
                </label>
                <label className="w-full border-2 border-dashed border-gray-300 rounded-lg px-4 py-8 text-sm cursor-pointer hover:border-[#2A742F] flex flex-col items-center justify-center gap-2">
                  <svg
                    className="w-10 h-10 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <span className="text-[#4B5563] text-center">
                    {receiptFile
                      ? receiptFile.name
                      : "Click to upload document"}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleReceiptUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading || !isFormValid()}
                className="w-full py-3 mt-4 rounded-lg text-white font-medium bg-gradient-to-r from-[#2A742F] to-[#04AF43] hover:shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? "Creating Profile..." : "Continue"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:hidden relative z-10 w-full min-h-screen flex items-center justify-center px-4 py-10 bg-white">
        <div className="w-full max-w-md space-y-5">
          {/* Mobile Title */}
          <div className="space-y-1 text-center">
            <h2 className="text-2xl font-semibold text-[#000]">
              Create Profile
            </h2>
            <p className="text-sm text-[#4B5563]">
              Complete your profile to get started
            </p>
          </div>

          <div className="flex justify-center mb-5">
            <div className="relative">
              {profileImage ? (
                <div className="relative">
                  <img
                    src={profileImage}
                    alt="profile"
                    className="w-24 h-24 rounded-full object-cover border-4 border-[#2A742F]"
                  />
                  <button
                    onClick={removeProfileImage}
                    className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <label className="w-24 h-24 rounded-full bg-gradient-to-br from-[#2A742F] to-[#04AF43] flex items-center justify-center cursor-pointer hover:opacity-90 transition-all">
                  <Camera className="text-white" size={32} />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <input
              type="text"
              name="firstName"
              placeholder="First Name"
              value={formData.firstName}
              onChange={handleInputChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#2A742F] focus:border-[#2A742F] focus:outline-none transition-all"
            />
            <input
              type="text"
              name="lastName"
              placeholder="Last Name"
              value={formData.lastName}
              onChange={handleInputChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#2A742F] focus:border-[#2A742F] focus:outline-none transition-all"
            />
            <input
              type="text"
              name="matricNumber"
              placeholder="Matric Number"
              value={formData.matricNumber}
              onChange={handleInputChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#2A742F] focus:border-[#2A742F] focus:outline-none transition-all"
            />
            <div className="relative w-full">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#2A742F] focus:border-[#2A742F] focus:outline-none transition-all pr-10"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-gray-500 focus:outline-none"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <input
              type="tel"
              name="phoneNumber"
              placeholder="Phone Number"
              value={formData.phoneNumber}
              onChange={handleInputChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#2A742F] focus:border-[#2A742F] focus:outline-none transition-all"
            />
            <select
              name="faculty"
              value={formData.faculty}
              onChange={handleInputChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#2A742F] focus:border-[#2A742F] focus:outline-none transition-all text-gray-700"
            >
              <option value="">Select Faculty</option>
              <option value="engineering">Engineering</option>
              <option value="science">Science</option>
              <option value="arts">Arts</option>
              <option value="social-sciences">Social Sciences</option>
              <option value="medicine">Medicine</option>
              <option value="law">Law</option>
            </select>
          </div>

          <div className="space-y-2 mt-3">
            <label className="text-sm font-medium text-[#4B5563]">
              School Fees Receipt
            </label>
            <label className="w-full border-2 border-dashed border-gray-300 rounded-lg px-4 py-8 text-sm cursor-pointer hover:border-[#2A742F] flex flex-col items-center justify-center gap-2">
              <svg
                className="w-10 h-10 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-[#4B5563] text-center">
                {receiptFile ? receiptFile.name : "Click to upload document"}
              </span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleReceiptUpload}
                className="hidden"
              />
            </label>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !isFormValid()}
            className="w-full py-3 mt-4 rounded-lg text-white font-medium bg-gradient-to-r from-[#2A742F] to-[#04AF43] hover:shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? "Creating Profile..." : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateProfile;
