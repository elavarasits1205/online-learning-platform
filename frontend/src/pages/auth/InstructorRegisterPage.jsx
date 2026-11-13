
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import LearnovaLogoMark from "../../component/LearnovaLogoMark";
import { IconButton, MenuItem, Select } from "@mui/material";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";

import { registerInstructor } from "../../service/Authapi";
import Button from "../../component/buttons/Button";
import InputField from "../../component/fields/InputField";
import instructorRegisterSchema from "../../validation/instructorRegisterSchema";
import "./InstructorRegisterPage.scss";

import instructorImage from "../../assets/Register Image/InstructorRegister.webp";



const rawSpecializationGroups = [
    { label: "Engineering", options: [
        "Aerospace Engineering", "Agricultural Engineering", "Automobile Engineering", "Biomedical Engineering",
        "Biotechnology Engineering", "Chemical Engineering", "Civil Engineering", "Computer Engineering",
        "Computer Science and Engineering", "Electrical Engineering", "Electronics and Communication Engineering",
        "Electronics and Instrumentation Engineering", "Environmental Engineering", "Industrial Engineering",
        "Information Technology", "Marine Engineering", "Materials and Metallurgical Engineering",
        "Mechanical Engineering", "Mechatronics Engineering", "Mining Engineering", "Petroleum Engineering",
        "Robotics and Automation Engineering", "Software Engineering", "Structural Engineering", "Textile Engineering",
    ] },
    { label: "Medicine and health sciences", options: [
        "Medicine", "Nursing", "Dentistry", "Pharmacy", "Physiotherapy", "Occupational Therapy",
        "Medical Laboratory Technology", "Radiology and Imaging", "Public Health", "Nutrition and Dietetics",
        "Veterinary Science", "Optometry", "Audiology and Speech Language Pathology",
        "Emergency Medical Services", "Medical Biotechnology",
    ] },
    { label: "Arts and humanities", options: [
        "English", "History", "Languages and Linguistics", "Philosophy", "Political Science", "Psychology",
        "Sociology", "Fine Arts", "Music", "Theatre and Performing Arts", "Journalism and Mass Communication", "Social Work",
    ] },
    { label: "Science and mathematics", options: [
        "Agriculture", "Biology", "Chemistry", "Environmental Science", "Geology", "Mathematics", "Physics", "Statistics", "Zoology", "Data Science",
    ] },
    { label: "Business and commerce", options: [
        "Accounting", "Banking and Insurance", "Business Administration", "Commerce", "Economics", "Finance", "Human Resource Management", "Marketing",
    ] },
    { label: "Computing and emerging technology", options: [
        "Artificial Intelligence and Machine Learning", "Cloud Computing", "Cybersecurity", "Computer Applications", "Information Systems",
    ] },
    { label: "Education and other fields", options: [
        "Education", "Law", "Architecture", "Interior Design", "Graphic Design", "Hospitality and Tourism", "Library and Information Science", "Other",
    ] },
];

const seenSpecializations = new Set();
const specializationGroups = rawSpecializationGroups.map((group) => ({
    ...group,
    options: group.options.filter((name) => {
        const normalized = name.trim().toLocaleLowerCase();
        if (seenSpecializations.has(normalized)) return false;
        seenSpecializations.add(normalized);
        return true;
    }),
}));
const initialFormData = {
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    username: "",
    password: "",
    confirmPassword: "",
    qualification: "",
    specialization: "",
    experienceYears: "",
    designation: "",
    bio: "",
};

function getResponseData(response) {
    const body = response?.data ?? response;
    return body?.data ?? body;
}

export default function InstructorRegisterPage() {
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [countryCode, setCountryCode] = useState("+91");
    const redirectTimer = useRef(null);

    const [formData, setFormData] = useState(initialFormData);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        return () => {
            if (redirectTimer.current) {
                clearTimeout(redirectTimer.current);
            }
        };
    }, []);

    function handleChange(event) {
        const { name, value } = event.target;
        const nextValue = name === "phoneNumber"
            ? value.replace(/\D/g, "").slice(0, 10)
            : name === "experienceYears" && value !== "" && Number(value) < 0
                ? "0"
                : value;

        setFormData((previous) => ({
            ...previous,
            [name]: nextValue,
        }));

        setErrors((previous) => ({
            ...previous,
            [name]: "",
        }));

        setError("");
        setSuccess("");
    }

    async function handleSubmit(event) {
        event.preventDefault();

        setErrors({});
        setError("");
        setSuccess("");

        try {
            const validatedData =
                await instructorRegisterSchema.validate(formData, {
                    abortEarly: false,
                    stripUnknown: true,
                });

            setLoading(true);

            const payload = {
                ...validatedData,
                firstName: validatedData.firstName.trim(),
                lastName: validatedData.lastName.trim(),
                email: validatedData.email.trim(),
                phoneNumber: countryCode + validatedData.phoneNumber.trim(),
                username: validatedData.username.trim(),
                qualification: validatedData.qualification.trim(),
                specialization: validatedData.specialization.trim(),
                experienceYears: validatedData.experienceYears ?? null,
                designation: (validatedData.designation || "").trim(),
                bio: (validatedData.bio || "").trim(),
            };

            const response = await registerInstructor(payload);
            const data = getResponseData(response);

            if (!data || data.success === false) {
                throw new Error(
                    data?.message || "Instructor registration failed."
                );
            }

            setSuccess(
                data.message ||
                    "Registration submitted successfully. Your account may require admin approval."
            );

            setFormData(initialFormData);

            redirectTimer.current = setTimeout(() => {
                navigate("/login", { replace: true });
            }, 1500);
        } catch (err) {
            if (err?.name === "ValidationError") {
                const validationErrors = {};

                err.inner?.forEach((item) => {
                    if (item.path && !validationErrors[item.path]) {
                        validationErrors[item.path] = item.message;
                    }
                });

                setErrors(validationErrors);
                return;
            }

            console.error("Instructor registration error:", err);

            setError(
                err?.response?.data?.message ||
                    err?.response?.data?.error ||
                    err?.message ||
                    "Instructor registration failed. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="instructor-register-page">
            <div className="instructor-register-shell">
                {/* Left branding panel */}
                <aside className="instructor-visual">
                    <Link to="/" className="instructor-brand">
                        <LearnovaLogoMark className="instructor-brand-icon" />
                        Learnova
                    </Link>

                    <div className="instructor-visual-main">
                        <span className="instructor-eyebrow">
                            YOUR NEXT CHAPTER STARTS HERE
                        </span>

                        <h1>
                            Teach what you love.
                            <span> Inspire the world.</span>
                        </h1>

                        <p>
                            Share your skills, create meaningful courses,
                            and help learners achieve their goals.
                        </p>

                        <img
                            src={instructorImage}
                            alt="Educator presenting an online learning platform"
                            className="instructor-hero-image"
                        />

                        <div className="instructor-benefit">
                            <span className="benefit-icon">✦</span>
                            <div>
                                <strong>Your expertise can make a difference.</strong>
                                <p>Learnova brings educators and learners together.</p>
                            </div>
                        </div>
                    </div>

                    <p className="instructor-visual-footer">
                        Empowering educators. Inspiring learners.
                    </p>
                </aside>

                {/* Right registration panel */}
                <section className="instructor-form-panel">
                    <div className="instructor-form-container">
                        <header className="instructor-form-header">
                            <span className="form-eyebrow">
                                INSTRUCTOR PORTAL
                            </span>

                            <h2>Create your instructor account</h2>

                            <p>
                                Complete your details to start your teaching
                                journey with Learnova.
                            </p>
                        </header>

                        <div className="instructor-approval-notice">
                            <span className="approval-icon">i</span>
                            <div>
                                <strong>Admin approval notice</strong>
                                <p>
                                    Your registration may require administrator
                                    approval before instructor access is granted.
                                </p>
                            </div>
                        </div>

                        {error && (
                            <div className="instructor-message error" role="alert">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="instructor-message success" role="status">
                                {success}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} noValidate>
                            <section className="instructor-form-section">
                                <div className="form-section-heading">
                                    <span>01</span>
                                    <div>
                                        <h3>Personal details</h3>
                                        <p>Your contact information</p>
                                    </div>
                                </div>

                                <div className="instructor-fields-grid">
                                    <InputField
                                        name="firstName"
                                        label="First name"
                                        value={formData.firstName}
                                        onChange={handleChange}
                                        autoComplete="given-name"
                                        disabled={loading}
                                        required
                                        error={Boolean(errors.firstName)}
                                        helperText={errors.firstName}
                                    />

                                    <InputField
                                        name="lastName"
                                        label="Last name"
                                        value={formData.lastName}
                                        onChange={handleChange}
                                        autoComplete="family-name"
                                        disabled={loading}
                                        required
                                        error={Boolean(errors.lastName)}
                                        helperText={errors.lastName}
                                    />

                                    <InputField
                                        name="email"
                                        label="Email address"
                                        type="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        autoComplete="email"
                                        disabled={loading}
                                        required
                                        error={Boolean(errors.email)}
                                        helperText={errors.email}
                                    />

                                    <InputField
                                        name="phoneNumber"
                                        label="Phone number"
                                        className="instructor-phone-field"
                                        type="tel"
                                        value={formData.phoneNumber}
                                        onChange={handleChange}
                                        autoComplete="tel"
                                        startAdornment={
                                            <Select
                                                variant="standard"
                                                disableUnderline
                                                value={countryCode}
                                                onChange={(event) => setCountryCode(event.target.value)}
                                                disabled={loading}
                                                aria-label="Phone country code"
                                                sx={{ minWidth: 108, fontSize: 14, whiteSpace: "nowrap" }}
                                            >
                                                <MenuItem value="+91">+91 India</MenuItem>
                                                <MenuItem value="+1">+1 US/Canada</MenuItem>
                                                <MenuItem value="+44">+44 UK</MenuItem>
                                                <MenuItem value="+61">+61 Australia</MenuItem>
                                                <MenuItem value="+65">+65 Singapore</MenuItem>
                                                <MenuItem value="+971">+971 UAE</MenuItem>
                                            </Select>
                                        }
                                        inputProps={{ inputMode: "numeric", maxLength: 10, pattern: "[0-9]{10}", placeholder: "10 digit mobile number" }}
                                        InputLabelProps={{ shrink: true }}
                                        disabled={loading}
                                        required
                                        error={Boolean(errors.phoneNumber)}
                                        helperText={errors.phoneNumber || "Enter exactly 10 digits."}
                                    />

                                    <div className="field-full">
                                        <InputField
                                            name="username"
                                            label="Username"
                                            value={formData.username}
                                            onChange={handleChange}
                                            autoComplete="username"
                                            disabled={loading}
                                            required
                                            error={Boolean(errors.username)}
                                            helperText={errors.username}
                                        />
                                    </div>
                                </div>
                            </section>

                            <section className="instructor-form-section">
                                <div className="form-section-heading">
                                    <span>02</span>
                                    <div>
                                        <h3>Professional details</h3>
                                        <p>Your qualifications and expertise</p>
                                    </div>
                                </div>

                                <div className="instructor-fields-grid">
                                    <InputField
                                        name="qualification"
                                        label="Highest qualification"
                                        value={formData.qualification}
                                        onChange={handleChange}
                                        select
                                        options={["High School", "Diploma", "Bachelor's Degree", "Master's Degree", "Doctorate", "Other"]}
                                        disabled={loading}
                                        required
                                        error={Boolean(errors.qualification)}
                                        helperText={errors.qualification}
                                    />

                                    <InputField
                                        name="specialization"
                                        label="Area of specialization"
                                        value={formData.specialization}
                                        onChange={handleChange}
                                        select
                                        options={specializationGroups}
                                        autoComplete="off"
                                        disabled={loading}
                                        required
                                        error={Boolean(errors.specialization)}
                                        helperText={errors.specialization}
                                    />

                                    <InputField
                                        name="experienceYears"
                                        label="Years of experience"
                                        type="number"
                                        value={formData.experienceYears}
                                        onChange={handleChange}
                                        disabled={loading}
                                        inputProps={{ min: 0, max: 80, step: 1 }}
                                        error={Boolean(errors.experienceYears)}
                                        helperText={errors.experienceYears}
                                    />

                                    <InputField
                                        name="designation"
                                        label="Current designation"
                                        value={formData.designation}
                                        onChange={handleChange}
                                        disabled={loading}
                                        error={Boolean(errors.designation)}
                                        helperText={errors.designation}
                                    />

                                    <div className="field-full">
                                        <InputField
                                            name="bio"
                                            label="Professional bio"
                                            value={formData.bio}
                                            onChange={handleChange}
                                            multiline
                                            rows={2}
                                            disabled={loading}
                                            error={Boolean(errors.bio)}
                                            helperText={errors.bio}
                                        />
                                    </div>
                                </div>
                            </section>

                            <section className="instructor-form-section">
                                <div className="form-section-heading">
                                    <span>03</span>
                                    <div>
                                        <h3>Account security</h3>
                                        <p>Keep your account secure</p>
                                    </div>
                                </div>

                                <div className="instructor-fields-grid single-column">
                                    <InputField
                                        name="password"
                                        label="Password"
                                        type={showPassword ? "text" : "password"}
                                        value={formData.password}
                                        onChange={handleChange}
                                        autoComplete="new-password"
                                        endAdornment={<IconButton type="button" className="instructor-password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} size="small">{showPassword ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}</IconButton>}
                                        disabled={loading}
                                        required
                                        error={Boolean(errors.password)}
                                        helperText={
                                            errors.password ||
                                            "Use at least 8 characters."
                                        }
                                    />

                                    <InputField
                                        name="confirmPassword"
                                        label="Confirm password"
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        autoComplete="new-password"
                                        endAdornment={<IconButton type="button" className="instructor-password-toggle" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? "Hide password" : "Show password"} aria-pressed={showConfirmPassword} size="small">{showConfirmPassword ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}</IconButton>}
                                        disabled={loading}
                                        required
                                        error={Boolean(errors.confirmPassword)}
                                        helperText={errors.confirmPassword}
                                    />
                                </div>
                            </section>

                            <div className="instructor-submit">
                                <Button
                                    type="submit"
                                    fullWidth
                                    loading={loading}
                                    disabled={loading}
                                >
                                    {loading
                                        ? "Creating account..."
                                        : "Create instructor account"}
                                </Button>

                                <p>
                                    Please check your information before
                                    submitting.
                                </p>
                            </div>
                        </form>

                        <div className="instructor-login-link">
                            Already have an account?{" "}
                            <Link to="/login">Login here</Link>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}
