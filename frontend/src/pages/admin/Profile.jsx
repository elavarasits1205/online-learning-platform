
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

import {
    UserRound,
    Mail,
    ShieldCheck,
    Hash,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    LockKeyhole,
    Pencil,
    Save,
    X
} from "lucide-react";

import {
    getCurrentAdminProfile,
    updateCurrentAdminProfile
} from "../../service/profileApi";
import { clearAuthUser, setAuthUser } from "../../utils/authCookie";
import "./Profile.scss";

// ============================================================
// GET USER INITIALS
// ============================================================

const getInitials = (firstName, lastName, username) => {
    const first = firstName?.trim()?.[0] || "";
    const last = lastName?.trim()?.[0] || "";

    if (first || last) {
        return `${first}${last}`.toUpperCase();
    }

    return username?.trim()?.[0]?.toUpperCase() || "A";
};

// ============================================================
// NORMALIZE ROLE DATA
// ============================================================

const normalizeItems = (items) => {
    if (!Array.isArray(items)) return [];

    return items
        .map((item) => {
            if (typeof item === "string") return item;
            return item?.code || item?.name || "";
        })
        .filter(Boolean);
};

// ============================================================
// PROFILE DETAIL ITEM
// ============================================================

function DetailItem({ icon: Icon, label, value }) {
    return (
        <div className="profile-detail-item">
            <div className="profile-detail-icon">
                <Icon size={18} />
            </div>

            <div className="profile-detail-content">
                <span className="profile-detail-label">
                    {label}
                </span>

                <span className="profile-detail-value">
                    {value || "Not available"}
                </span>
            </div>
        </div>
    );
}

// ============================================================
// ADMIN PROFILE COMPONENT
// ============================================================

function Profile() {
    const navigate = useNavigate();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [saveSuccess, setSaveSuccess] = useState("");
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        username: ""
    });

    // --------------------------------------------------------
    // LOAD PROFILE
    // --------------------------------------------------------

    const loadProfile = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const result = await getCurrentAdminProfile();

            if (!result) {
                throw new Error("Profile information was not returned.");
            }

            setProfile(result);
            setFormData({
                firstName: result.firstName ?? "",
                lastName: result.lastName ?? "",
                username: result.username ?? ""
            });
        } catch (err) {
            const status =
                err.response?.status || err.statusCode;

            if (status === 401) {
                // Tokens are HttpOnly cookies and are cleared by the backend.
                clearAuthUser();

                navigate("/login", { replace: true });
                return;
            }

            setError(
                err.response?.data?.message ||
                err.message ||
                "Unable to load profile information."
            );
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    // --------------------------------------------------------
    // INITIAL PROFILE LOAD
    // --------------------------------------------------------

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    const handleStartEditing = () => {
        setFormData({
            firstName: profile?.firstName ?? "",
            lastName: profile?.lastName ?? "",
            username: profile?.username ?? ""
        });
        setSaveError("");
        setSaveSuccess("");
        setIsEditing(true);
    };

    const handleCancelEditing = useCallback(() => {
        setFormData({
            firstName: profile?.firstName ?? "",
            lastName: profile?.lastName ?? "",
            username: profile?.username ?? ""
        });
        setSaveError("");
        setIsEditing(false);
    }, [profile]);

    useEffect(() => {
        if (!isEditing) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleKeyDown = (event) => {
            if (event.key === "Escape" && !saving) {
                handleCancelEditing();
                return;
            }

            if (event.key === "Tab") {
                const drawer = document.querySelector(".profile-drawer");
                const focusableElements = drawer?.querySelectorAll(
                    'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
                );

                if (!focusableElements?.length) return;

                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];

                if (event.shiftKey && document.activeElement === firstElement) {
                    event.preventDefault();
                    lastElement.focus();
                } else if (!event.shiftKey && document.activeElement === lastElement) {
                    event.preventDefault();
                    firstElement.focus();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [handleCancelEditing, isEditing, saving]);

    const handleProfileInput = (event) => {
        const { name, value } = event.target;
        setFormData((current) => ({ ...current, [name]: value }));
        setSaveError("");
    };

    const handleSaveProfile = async (event) => {
        event.preventDefault();
        if (saving) return;

        setSaving(true);
        setSaveError("");
        setSaveSuccess("");

        try {
            const updatedProfile = await updateCurrentAdminProfile({
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                username: formData.username.trim()
            });

            setProfile(updatedProfile);
            setFormData({
                firstName: updatedProfile.firstName ?? "",
                lastName: updatedProfile.lastName ?? "",
                username: updatedProfile.username ?? ""
            });
            setAuthUser(updatedProfile);
            setIsEditing(false);
            setSaveSuccess("Your profile has been updated.");
        } catch (saveRequestError) {
            setSaveError(
                saveRequestError.response?.data?.message ||
                saveRequestError.message ||
                "Unable to update your profile. Please try again."
            );
        } finally {
            setSaving(false);
        }
    };

    // --------------------------------------------------------
    // PROFILE DATA
    // --------------------------------------------------------

    const roles = useMemo(
        () => normalizeItems(profile?.roles),
        [profile]
    );

    const isAdmin = roles.some(
        (role) => role.toUpperCase() === "ADMIN"
    );

    const displayName = [
        profile?.firstName,
        profile?.lastName
    ]
        .filter(Boolean)
        .join(" ") || profile?.username || "Administrator";

    const initials = getInitials(
        profile?.firstName,
        profile?.lastName,
        profile?.username
    );

    // --------------------------------------------------------
    // LOADING STATE
    // --------------------------------------------------------

    if (loading) {
        return (
            <div className="profile-state">
                <div className="profile-loader" />

                <p>Loading your profile...</p>
            </div>
        );
    }

    // --------------------------------------------------------
    // ERROR STATE
    // --------------------------------------------------------

    if (error) {
        return (
            <div className="profile-state">
                <div className="profile-state-icon error">
                    <AlertCircle size={26} />
                </div>

                <h2>Unable to load profile</h2>

                <p>{error}</p>

                <button
                    type="button"
                    className="profile-primary-button"
                    onClick={loadProfile}
                >
                    <RefreshCw size={16} />
                    Try again
                </button>
            </div>
        );
    }

    if (!profile) return null;

    // --------------------------------------------------------
    // ADMIN ROLE VALIDATION
    // --------------------------------------------------------

    if (!isAdmin) {
        return (
            <div className="profile-state">
                <div className="profile-state-icon error">
                    <LockKeyhole size={26} />
                </div>

                <h2>Admin access required</h2>

                <p>
                    This page is intended for administrator accounts.
                </p>

                <button
                    type="button"
                    className="profile-primary-button"
                    onClick={() => navigate("/")}
                >
                    Go to dashboard
                </button>
            </div>
        );
    }

    // ========================================================
    // PROFILE UI
    // ========================================================

    return (
        <div className="admin-profile-page">

            {/* PAGE HEADER */}

            <div className="profile-page-header">
                <div>
                    <span className="profile-eyebrow">
                        ACCOUNT SETTINGS
                    </span>

                    <h1>My Profile</h1>

                    <p>View and manage your administrator profile information.</p>
                </div>

                <div className="profile-header-actions">
                    <button
                        type="button"
                        className="profile-refresh-button"
                        onClick={loadProfile}
                        disabled={loading || saving}
                    >
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                    <button
                        type="button"
                        className="profile-primary-button"
                        onClick={handleStartEditing}
                        disabled={loading || saving}
                    >
                        <Pencil size={16} />
                        Edit profile
                    </button>
                </div>
            </div>

            {saveSuccess && (
                <div
                    className="profile-feedback success"
                    role="status"
                >
                    <CheckCircle2 size={17} />
                    <span>{saveSuccess}</span>
                </div>
            )}

            {/* PROFILE SUMMARY */}

            <section className="profile-hero-card">

                <div className="profile-avatar">
                    {initials}
                </div>

                <div className="profile-hero-info">
                    <h2>{displayName}</h2>

                    <p>
                        @{profile.username || "username"}
                    </p>

                    <div className="profile-hero-badges">

                        <span className="profile-role-badge">
                            <ShieldCheck size={14} />
                            Administrator
                        </span>

                        <span className="profile-status-badge">
                            <CheckCircle2 size={14} />
                            Authenticated
                        </span>

                    </div>
                </div>

                

            </section>

            {/* PROFILE CONTENT */}

            <div className="profile-content-grid">

                {/* PERSONAL INFORMATION */}

                <section className="profile-panel">

                    <div className="profile-panel-heading">

                        <div className="profile-panel-heading-icon">
                            <UserRound size={19} />
                        </div>

                        <div>
                            <h3>Personal Information</h3>

                            <p>
                                Your registered account details
                            </p>
                        </div>

                    </div>

                    <div className="profile-details-grid">
                        <DetailItem
                            icon={UserRound}
                            label="First Name"
                            value={profile.firstName}
                        />

                        <DetailItem
                            icon={UserRound}
                            label="Last Name"
                            value={profile.lastName}
                        />

                        <DetailItem
                            icon={Hash}
                            label="Username"
                            value={profile.username}
                        />

                        <DetailItem
                            icon={Mail}
                            label="Email Address"
                            value={profile.email}
                        />
                    </div>

                </section>

                {/* ROLE INFORMATION */}

                <section className="profile-panel">

                    <div className="profile-panel-heading">

                        <div className="profile-panel-heading-icon">
                            <ShieldCheck size={19} />
                        </div>

                        <div>
                            <h3>Role Information</h3>

                            <p>
                                Roles assigned to your account
                            </p>
                        </div>

                    </div>

                    <div className="profile-chip-list">

                        {roles.length > 0 ? (
                            roles.map((role) => (
                                <span
                                    className="profile-chip"
                                    key={role}
                                >
                                    <ShieldCheck size={14} />
                                    {role}
                                </span>
                            ))
                        ) : (
                            <p className="profile-empty">
                                No roles are assigned.
                            </p>
                        )}

                    </div>

                </section>

            </div>

            {isEditing && createPortal(
                <div
                    className="profile-drawer-backdrop"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget && !saving) {
                            handleCancelEditing();
                        }
                    }}
                >
                    <section
                        className="profile-drawer"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="profile-drawer-title"
                        aria-describedby="profile-drawer-description"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <header className="profile-drawer-header">
                            <div className="profile-drawer-heading-icon">
                                <UserRound size={20} />
                            </div>
                            <div className="profile-drawer-heading-copy">
                                <h2 id="profile-drawer-title">Edit profile</h2>
                                <p id="profile-drawer-description">
                                    Update the name and username associated with your account.
                                </p>
                            </div>
                            <button
                                type="button"
                                className="profile-drawer-close"
                                onClick={handleCancelEditing}
                                disabled={saving}
                                aria-label="Close profile editor"
                            >
                                <X size={19} />
                            </button>
                        </header>

                        <form
                            className="profile-drawer-form"
                            onSubmit={handleSaveProfile}
                        >
                            <div className="profile-drawer-content">
                                {saveError && (
                                    <div className="profile-feedback error" role="alert">
                                        <AlertCircle size={17} />
                                        <span>{saveError}</span>
                                    </div>
                                )}

                                <label className="profile-edit-field">
                                    <span>First Name</span>
                                    <input
                                        name="firstName"
                                        value={formData.firstName}
                                        onChange={handleProfileInput}
                                        autoComplete="given-name"
                                        maxLength={100}
                                        autoFocus
                                        required
                                    />
                                </label>

                                <label className="profile-edit-field">
                                    <span>Last Name</span>
                                    <input
                                        name="lastName"
                                        value={formData.lastName}
                                        onChange={handleProfileInput}
                                        autoComplete="family-name"
                                        maxLength={100}
                                    />
                                </label>

                                <label className="profile-edit-field">
                                    <span>Username</span>
                                    <input
                                        name="username"
                                        value={formData.username}
                                        onChange={handleProfileInput}
                                        autoComplete="username"
                                        minLength={3}
                                        maxLength={30}
                                        pattern="[A-Za-z0-9_.-]+"
                                        title="Use 3–30 letters, numbers, dots, underscores, or hyphens."
                                        required
                                    />
                                    <small>3–30 characters; letters, numbers, dots, underscores, and hyphens.</small>
                                </label>

                                <div className="profile-drawer-readonly">
                                    <div className="profile-detail-icon">
                                        <Mail size={18} />
                                    </div>
                                    <div className="profile-detail-content">
                                        <span className="profile-detail-label">Email Address</span>
                                        <span className="profile-detail-value">{profile.email || "Not available"}</span>
                                        <small>Email cannot be changed here.</small>
                                    </div>
                                </div>
                            </div>

                            <footer className="profile-drawer-footer">
                                <button
                                    type="button"
                                    className="profile-refresh-button"
                                    onClick={handleCancelEditing}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="profile-primary-button"
                                    disabled={saving}
                                >
                                    <Save size={16} />
                                    {saving ? "Saving..." : "Save changes"}
                                </button>
                            </footer>
                        </form>
                    </section>
                </div>,
                document.body
            )}

            {/* PROFILE EDITING NOTE */}

            <div className="profile-readonly-note">

                <LockKeyhole size={17} />

                <span>
                    You can change your name and username here. Email address
                    and role assignments are managed separately.
                </span>

            </div>

        </div>
    );
}

export default Profile;
