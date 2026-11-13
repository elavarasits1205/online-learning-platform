import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  Paper,
  TextField,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import CameraAltRoundedIcon from "@mui/icons-material/CameraAltRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import DevicesRoundedIcon from "@mui/icons-material/DevicesRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import api from "../../service/Api";
import { clearAuthUser, getAuthUser, setAuthUser } from "../../utils/authCookie";
import LearnovaBackNavigation from "../../component/LearnovaBackNavigation";
import "./StudentProfilePage.scss";

const emptyProfile = {
  first_name: "",
  last_name: "",
  email: "",
  username: "",
  phone_number: "",
  student_code: "",
  register_number: "",
  date_of_birth: "",
  gender: "",
  profile_image_url: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "",
  bio: "",
};

const defaultNotificationPreferences = {
  courseAnnouncements: true,
  assignmentAssessment: true,
  newCourses: true,
  community: true,
  payments: true,
  certificates: true,
  email: true,
};

const notificationPreferenceOptions = [
  ["courseAnnouncements", "Course announcements"],
  ["assignmentAssessment", "Assignment/assessment notifications"],
  ["newCourses", "New course notifications"],
  ["community", "Community notifications"],
  ["payments", "Payment notifications"],
  ["certificates", "Certificate notifications"],
  ["email", "Email notifications"],
];

const defaultAccountPreferences = {
  language: "en",
  timezone: "UTC",
  emailFrequency: "immediately",
};

const supportedTimeZones =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["UTC", "Asia/Kolkata", "America/Los_Angeles", "America/New_York", "Europe/London"];

function formatSecurityDate(value, language, timezone) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  try {
    return new Intl.DateTimeFormat(language, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function updateSignedInUser(profile) {
  const currentUser = getAuthUser();
  if (!currentUser) return;

  setAuthUser({
    ...currentUser,
    firstName: profile.first_name ?? currentUser.firstName,
    first_name: profile.first_name ?? currentUser.first_name,
    lastName: profile.last_name ?? currentUser.lastName,
    last_name: profile.last_name ?? currentUser.last_name,
    profile_image_url:
      profile.profile_image_url ?? currentUser.profile_image_url,
    profileImageUrl: profile.profile_image_url ?? currentUser.profileImageUrl,
  });
}

function profileCompleteness(profile) {
  const fields = [
    profile.first_name,
    profile.last_name,
    profile.phone_number,
    profile.date_of_birth,
    profile.gender,
    profile.profile_image_url,
    profile.address_line1,
    profile.city,
    profile.state,
    profile.postal_code,
    profile.country,
    profile.bio,
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

export default function StudentProfilePage() {
  const navigate = useNavigate();
  const authUser = useMemo(() => getAuthUser(), []);
  const fallbackName =
    authUser?.firstName ??
    authUser?.first_name ??
    authUser?.name ??
    authUser?.username ??
    "Student";
  const [profile, setProfile] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeSettingsTab, setActiveSettingsTab] = useState("profile");
  const [notificationPreferences, setNotificationPreferences] = useState(
    defaultNotificationPreferences,
  );
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesError, setPreferencesError] = useState("");
  const [preferencesSaved, setPreferencesSaved] = useState(false);
  const [accountPreferences, setAccountPreferences] = useState(
    defaultAccountPreferences,
  );
  const [accountPreferencesLoading, setAccountPreferencesLoading] = useState(true);
  const [accountPreferencesSaving, setAccountPreferencesSaving] = useState(false);
  const [accountPreferencesError, setAccountPreferencesError] = useState("");
  const [accountPreferencesSaved, setAccountPreferencesSaved] = useState(false);
  const [passwordFields, setPasswordFields] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [logoutAllConfirm, setLogoutAllConfirm] = useState(false);
  const [logoutAllSaving, setLogoutAllSaving] = useState(false);
  const [securityError, setSecurityError] = useState("");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setProfileLoaded(false);
    setError("");
    setSuccess("");

    try {
      const response = await api.get("/student/profile");
      const profileData = response.data?.data?.profile;
      if (!profileData) {
        throw new Error("Profile data was missing from the API response.");
      }
      setProfile({ ...emptyProfile, ...profileData });
      setProfileLoaded(true);
    } catch (loadError) {
      setError(
        loadError.response?.data?.message ||
          loadError.message ||
          "Unable to load your profile. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const loadNotificationPreferences = useCallback(async () => {
    setPreferencesLoading(true);
    setPreferencesError("");
    setPreferencesSaved(false);
    try {
      const response = await api.get("/student/notification-preferences");
      const saved = response.data?.data?.preferences;
      setNotificationPreferences({
        ...defaultNotificationPreferences,
        ...(saved && typeof saved === "object" ? saved : {}),
      });
    } catch (loadError) {
      setPreferencesError(
        loadError.response?.data?.message ||
          "Unable to load notification settings. Please try again.",
      );
    } finally {
      setPreferencesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotificationPreferences();
  }, [loadNotificationPreferences]);

  const loadAccountPreferences = useCallback(async () => {
    setAccountPreferencesLoading(true);
    setAccountPreferencesError("");
    setAccountPreferencesSaved(false);
    try {
      const response = await api.get("/student/account-preferences");
      const saved = response.data?.data?.preferences;
      setAccountPreferences({
        ...defaultAccountPreferences,
        ...(saved && typeof saved === "object" ? saved : {}),
      });
    } catch (loadError) {
      setAccountPreferencesError(
        loadError.response?.data?.message ||
          "Unable to load your account preferences. Please try again.",
      );
    } finally {
      setAccountPreferencesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccountPreferences();
  }, [loadAccountPreferences]);

  const handleAccountPreferenceChange = async (key, value) => {
    const previousValue = accountPreferences[key];
    setAccountPreferences((current) => ({ ...current, [key]: value }));
    setAccountPreferencesSaving(true);
    setAccountPreferencesError("");
    setAccountPreferencesSaved(false);
    try {
      const response = await api.patch("/student/account-preferences", {
        [key]: value,
      });
      const saved = response.data?.data?.preferences;
      if (saved) {
        setAccountPreferences({ ...defaultAccountPreferences, ...saved });
      }
      setAccountPreferencesSaved(true);
    } catch (saveError) {
      setAccountPreferences((current) => ({ ...current, [key]: previousValue }));
      setAccountPreferencesError(
        saveError.response?.data?.message ||
          "Unable to save this preference. Please try again.",
      );
    } finally {
      setAccountPreferencesSaving(false);
    }
  };

  const handleNotificationPreferenceChange = async (key, checked) => {
    const previousValue = notificationPreferences[key];
    setNotificationPreferences((current) => ({ ...current, [key]: checked }));
    setPreferencesSaving(true);
    setPreferencesError("");
    setPreferencesSaved(false);
    try {
      const response = await api.patch("/student/notification-preferences", {
        [key]: checked,
      });
      const saved = response.data?.data?.preferences;
      if (saved) {
        setNotificationPreferences({
          ...defaultNotificationPreferences,
          ...saved,
        });
      }
      setPreferencesSaved(true);
    } catch (saveError) {
      setNotificationPreferences((current) => ({
        ...current,
        [key]: previousValue,
      }));
      setPreferencesError(
        saveError.response?.data?.message ||
          "Unable to save this notification setting. Please try again.",
      );
    } finally {
      setPreferencesSaving(false);
    }
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    if (passwordFields.newPassword.length < 8) {
      setPasswordError("Use at least 8 characters for your new password.");
      return;
    }
    if (new TextEncoder().encode(passwordFields.newPassword).length > 72) {
      setPasswordError("Your new password must be no more than 72 bytes.");
      return;
    }
    if (passwordFields.newPassword !== passwordFields.confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      const response = await api.post("/auth/change-password", {
        currentPassword: passwordFields.currentPassword,
        newPassword: passwordFields.newPassword,
      });
      setPasswordFields({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordSuccess(
        response.data?.message || "Password changed. Sign in again with your new password.",
      );
      window.setTimeout(() => {
        clearAuthUser();
        navigate("/login", { replace: true });
      }, 1200);
    } catch (changeError) {
      setPasswordError(
        changeError.response?.data?.message ||
          "Unable to change your password. Please try again.",
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleLogoutAllDevices = async () => {
    setLogoutAllSaving(true);
    setSecurityError("");
    try {
      await api.post("/auth/logout-all", {});
      clearAuthUser();
      navigate("/login", { replace: true });
    } catch (logoutError) {
      setSecurityError(
        logoutError.response?.data?.message ||
          "Unable to sign out other devices. Please try again.",
      );
      setLogoutAllSaving(false);
      setLogoutAllConfirm(false);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setProfile((current) => ({ ...current, [name]: value }));
    setError("");
    setSuccess("");
  };

  const handleImageUpload = async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setError("");
    setSuccess("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      input.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("The profile image must be 5 MB or smaller.");
      input.value = "";
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const response = await api.post("/student/profile/image", formData);
      const profileData = response.data?.data?.profile;
      if (!profileData?.profile_image_url) {
        throw new Error("The uploaded profile image URL was not returned.");
      }
      setProfile((current) => ({ ...current, ...profileData }));
      updateSignedInUser({
        ...profile,
        ...profileData,
      });
      setSuccess("Profile photo uploaded successfully.");
    } catch (uploadError) {
      setError(
        uploadError.response?.data?.message ||
          uploadError.message ||
          "Unable to upload your profile photo. Please try again.",
      );
    } finally {
      setUploading(false);
      input.value = "";
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      firstName: profile.first_name?.trim() ?? "",
      lastName: profile.last_name?.trim() ?? "",
      phoneNumber: profile.phone_number?.trim() ?? "",
      dateOfBirth: profile.date_of_birth
        ? String(profile.date_of_birth).slice(0, 10)
        : null,
      gender: profile.gender || null,
      profileImageUrl: profile.profile_image_url || null,
      addressLine1: profile.address_line1?.trim() ?? "",
      addressLine2: profile.address_line2?.trim() ?? "",
      city: profile.city?.trim() ?? "",
      state: profile.state?.trim() ?? "",
      postalCode: profile.postal_code?.trim() ?? "",
      country: profile.country?.trim() ?? "",
      bio: profile.bio?.trim() ?? "",
    };

    try {
      await api.patch("/student/profile", payload);
      const response = await api.get("/student/profile");
      const profileData = response.data?.data?.profile;
      const updatedProfile = profileData
        ? { ...emptyProfile, ...profileData }
        : profile;
      setProfile(updatedProfile);
      updateSignedInUser(updatedProfile);
      setSuccess("Your profile has been saved.");
    } catch (saveError) {
      setError(
        saveError.response?.data?.message ||
          "Unable to save your profile. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const fullName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    fallbackName;
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const completion = profileCompleteness(profile);

  return (
    <main className="student-profile-page student-page student-page--inset">
      <LearnovaBackNavigation />
      <header className="student-profile-page__heading">
        <div>
          <span className="student-profile-page__eyebrow">ACCOUNT SETTINGS</span>
          <Typography component="h1">Account settings</Typography>
          <p>Manage your profile, preferences, and sign-in security.</p>
        </div>
      </header>

      <Tabs
        value={activeSettingsTab}
        onChange={(_, value) => setActiveSettingsTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Account settings sections"
        className="student-profile-page__tabs"
      >
        <Tab value="profile" icon={<PersonRoundedIcon />} iconPosition="start" label="Profile" />
        <Tab value="notifications" icon={<NotificationsNoneRoundedIcon />} iconPosition="start" label="Notifications" />
        <Tab value="preferences" icon={<LanguageRoundedIcon />} iconPosition="start" label="Preferences" />
        <Tab value="security" icon={<SecurityRoundedIcon />} iconPosition="start" label="Login & security" />
      </Tabs>

      {error && (
        <Alert
          severity="error"
          className="student-profile-page__alert"
          action={
            !profileLoaded && !loading ? (
              <Button onClick={loadProfile}>Retry</Button>
            ) : null
          }
        >
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" className="student-profile-page__alert">
          {success}
        </Alert>
      )}

      {activeSettingsTab === "profile" && (loading ? (
        <Paper className="student-profile-page__loading" elevation={0}>
          <CircularProgress size={26} />
          <Typography>Loading your profile…</Typography>
        </Paper>
      ) : profileLoaded ? (
        <form className="student-profile-page__form" onSubmit={handleSave}>
          <Paper className="student-profile-page__hero" elevation={0}>
            <div className="student-profile-page__identity">
              <Avatar
                className="student-profile-page__avatar"
                src={profile.profile_image_url || undefined}
              >
                {initials || "S"}
              </Avatar>
              <div className="student-profile-page__identity-copy">
                <Typography component="h2">{fullName}</Typography>
                <span>{profile.email || "Student account"}</span>
                <div className="student-profile-page__identity-meta">
                  <span className="student-profile-page__status">
                    <CheckCircleRoundedIcon /> Active student
                  </span>
                  {profile.student_code && <span>ID · {profile.student_code}</span>}
                </div>
              </div>
            </div>

            <div className="student-profile-page__completion">
              <div>
                <span>Profile completion</span>
                <strong>{completion}%</strong>
              </div>
              <div className="student-profile-page__progress-track">
                <span style={{ width: `${completion}%` }} />
              </div>
              <Button
                component="label"
                variant="outlined"
                startIcon={
                  uploading ? (
                    <CircularProgress size={16} />
                  ) : (
                    <CameraAltRoundedIcon />
                  )
                }
                disabled={uploading || saving}
                className="student-profile-page__upload"
              >
                {uploading
                  ? "Uploading…"
                  : profile.profile_image_url
                    ? "Change photo"
                    : "Add a profile photo"}
                <input
                  hidden
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageUpload}
                />
              </Button>
              <small>JPG, PNG or WebP · Up to 5 MB</small>
            </div>
          </Paper>

          <Paper
            component="section"
            className="student-profile-page__section"
            elevation={0}
          >
            <div className="student-profile-page__section-heading">
              <span className="student-profile-page__section-icon">
                <PersonRoundedIcon />
              </span>
              <div>
                <Typography component="h2">Personal information</Typography>
                <p>How we identify and contact you.</p>
              </div>
            </div>
            <Divider />
            <Box className="student-profile-page__fields">
              <TextField
                label="First name"
                name="first_name"
                value={profile.first_name}
                onChange={handleChange}
                required
                size="small"
              />
              <TextField
                label="Last name"
                name="last_name"
                value={profile.last_name}
                onChange={handleChange}
                required
                size="small"
              />
              <TextField
                label="Email"
                value={profile.email || ""}
                type="email"
                size="small"
                slotProps={{ input: { readOnly: true } }}
                helperText="Email cannot be changed here."
              />
              <TextField
                label="Username"
                value={profile.username || ""}
                size="small"
                slotProps={{ input: { readOnly: true } }}
              />
              <TextField
                label="Phone number"
                name="phone_number"
                value={profile.phone_number || ""}
                onChange={handleChange}
                size="small"
              />
              <TextField
                label="Date of birth"
                name="date_of_birth"
                type="date"
                value={
                  profile.date_of_birth
                    ? String(profile.date_of_birth).slice(0, 10)
                    : ""
                }
                onChange={handleChange}
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Gender"
                name="gender"
                value={profile.gender || ""}
                onChange={(event) =>
                  handleChange({
                    target: {
                      name: "gender",
                      value: event.target.value.toUpperCase(),
                    },
                  })
                }
                size="small"
                select
                slotProps={{ select: { native: true } }}
              >
                <option value="">Not specified</option>
                <option value="FEMALE">Female</option>
                <option value="MALE">Male</option>
                <option value="OTHER">Other</option>
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
              </TextField>
            </Box>
          </Paper>

          <Paper
            component="section"
            className="student-profile-page__section"
            elevation={0}
          >
            <div className="student-profile-page__section-heading">
              <span className="student-profile-page__section-icon">
                <PlaceRoundedIcon />
              </span>
              <div>
                <Typography component="h2">Location</Typography>
                <p>Your address details.</p>
              </div>
            </div>
            <Divider />
            <Box className="student-profile-page__fields">
              <TextField
                label="Address line 1"
                name="address_line1"
                value={profile.address_line1 || ""}
                onChange={handleChange}
                size="small"
              />
              <TextField
                label="Address line 2"
                name="address_line2"
                value={profile.address_line2 || ""}
                onChange={handleChange}
                size="small"
              />
              <TextField
                label="City"
                name="city"
                value={profile.city || ""}
                onChange={handleChange}
                size="small"
              />
              <TextField
                label="State / province"
                name="state"
                value={profile.state || ""}
                onChange={handleChange}
                size="small"
              />
              <TextField
                label="Postal code"
                name="postal_code"
                value={profile.postal_code || ""}
                onChange={handleChange}
                size="small"
              />
              <TextField
                label="Country"
                name="country"
                value={profile.country || ""}
                onChange={handleChange}
                size="small"
              />
            </Box>
          </Paper>

          <Paper
            component="section"
            className="student-profile-page__section"
            elevation={0}
          >
            <div className="student-profile-page__section-heading">
              <span className="student-profile-page__section-icon">
                <PersonRoundedIcon />
              </span>
              <div>
                <Typography component="h2">About you</Typography>
                <p>Share a short introduction with the learning community.</p>
              </div>
            </div>
            <Divider />
            <TextField
              label="Short bio"
              name="bio"
              value={profile.bio || ""}
              onChange={handleChange}
              multiline
              minRows={3}
              fullWidth
              size="small"
              inputProps={{ maxLength: 500 }}
              helperText={`${(profile.bio || "").length}/500 characters`}
            />
          </Paper>

          <div className="student-profile-page__actions">
            <Typography component="span">
              Your profile is only shared where it supports your learning.
            </Typography>
            <Button
              type="submit"
              variant="contained"
              startIcon={
                saving ? (
                  <CircularProgress size={17} color="inherit" />
                ) : (
                  <SaveRoundedIcon />
                )
              }
              disabled={saving || uploading}
            >
              {saving ? "Saving changes…" : "Save changes"}
            </Button>
          </div>
        </form>
      ) : null)}

      {activeSettingsTab === "notifications" && (
        <div className="student-profile-page__settings-stack">
      <Paper
        component="section"
        className="student-profile-page__section student-profile-page__account-settings-card"
        elevation={0}
      >
        <div className="student-profile-page__section-heading">
          <span className="student-profile-page__section-icon">
            <EmailRoundedIcon />
          </span>
          <div>
            <Typography component="h2">Email preferences</Typography>
            <p>Choose when email notifications are delivered to your inbox.</p>
          </div>
        </div>
        <Divider />
        {accountPreferencesError && (
          <Alert
            severity="error"
            action={
              accountPreferencesLoading ? null : (
                <Button size="small" onClick={loadAccountPreferences}>
                  Retry
                </Button>
              )
            }
          >
            {accountPreferencesError}
          </Alert>
        )}
        <Typography component="p" className="student-profile-page__notification-status">
          Email notifications are controlled in Notification preferences.
        </Typography>
        <TextField
          select
          slotProps={{ select: { native: true } }}
          label="Email frequency"
          value={accountPreferences.emailFrequency}
          disabled={accountPreferencesLoading || accountPreferencesSaving}
          onChange={(event) =>
            handleAccountPreferenceChange("emailFrequency", event.target.value)
          }
          size="small"
        >
          <option value="immediately">Immediately</option>
          <option value="daily">Daily digest</option>
          <option value="weekly">Weekly digest</option>
        </TextField>
        <Typography component="p" className="student-profile-page__notification-status" aria-live="polite">
          {accountPreferencesLoading
            ? "Loading email preferences…"
            : accountPreferencesSaving
              ? "Saving…"
              : accountPreferencesSaved
                ? "Your email preferences are saved."
                : "Changes are saved automatically."}
        </Typography>
      </Paper>

      <Paper
        component="section"
        className="student-profile-page__section student-profile-page__notification-settings"
        elevation={0}
      >
        <div className="student-profile-page__section-heading">
          <span className="student-profile-page__section-icon">
            <NotificationsNoneRoundedIcon />
          </span>
          <div>
            <Typography component="h2">Notification preferences</Typography>
            <p>Choose which updates you want to receive.</p>
          </div>
        </div>
        <Divider />
        {preferencesError && (
          <Alert
            severity="error"
            action={
              preferencesLoading ? null : (
                <Button size="small" onClick={loadNotificationPreferences}>
                  Retry
                </Button>
              )
            }
          >
            {preferencesError}
          </Alert>
        )}
        <div className="student-profile-page__notification-options">
          {notificationPreferenceOptions.map(([key, label]) => (
            <div className="student-profile-page__notification-option" key={key}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={Boolean(notificationPreferences[key])}
                    disabled={preferencesLoading || preferencesSaving}
                    onChange={(event) =>
                      handleNotificationPreferenceChange(key, event.target.checked)
                    }
                  />
                }
                label={label}
              />
            </div>
          ))}
        </div>
        <Typography
          component="p"
          className="student-profile-page__notification-status"
          aria-live="polite"
        >
          {preferencesLoading
            ? "Loading your notification settings…"
            : preferencesSaving
              ? "Saving…"
              : preferencesSaved
                ? "Your notification settings are saved."
                : "Changes are saved automatically."}
        </Typography>
      </Paper>
        </div>
      )}

      {activeSettingsTab === "preferences" && (
      <Paper
        component="section"
        className="student-profile-page__section student-profile-page__account-settings-card"
        elevation={0}
      >
        <div className="student-profile-page__section-heading">
          <span className="student-profile-page__section-icon">
            <LanguageRoundedIcon />
          </span>
          <div>
            <Typography component="h2">Language and timezone</Typography>
            <p>Set your preferred language and local time zone.</p>
          </div>
        </div>
        <Divider />
        <Box className="student-profile-page__fields">
          <TextField
            select
            slotProps={{ select: { native: true } }}
            label="Language"
            value={accountPreferences.language}
            disabled={accountPreferencesLoading || accountPreferencesSaving}
            onChange={(event) =>
              handleAccountPreferenceChange("language", event.target.value)
            }
            size="small"
          >
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
          </TextField>
          <TextField
            select
            slotProps={{ select: { native: true } }}
            label="Timezone"
            value={accountPreferences.timezone}
            disabled={accountPreferencesLoading || accountPreferencesSaving}
            onChange={(event) =>
              handleAccountPreferenceChange("timezone", event.target.value)
            }
            size="small"
          >
            {!supportedTimeZones.includes(accountPreferences.timezone) && (
              <option value={accountPreferences.timezone}>
                {accountPreferences.timezone}
              </option>
            )}
            {supportedTimeZones.map((timezone) => (
              <option value={timezone} key={timezone}>{timezone}</option>
            ))}
          </TextField>
        </Box>
        <Typography component="p" className="student-profile-page__notification-status" aria-live="polite">
          {accountPreferencesLoading
            ? "Loading language and timezone…"
            : accountPreferencesSaving
              ? "Saving…"
              : accountPreferencesSaved
                ? "Your language and timezone are saved."
                : "Changes are saved automatically."}
        </Typography>
        {accountPreferencesError && (
          <Alert severity="error" className="student-profile-page__alert">
            {accountPreferencesError}
          </Alert>
        )}
      </Paper>
      )}

      {activeSettingsTab === "security" && (
      <Paper
        component="section"
        className="student-profile-page__section student-profile-page__account-settings-card"
        elevation={0}
      >
        <div className="student-profile-page__section-heading">
          <span className="student-profile-page__section-icon">
            <SecurityRoundedIcon />
          </span>
          <div>
            <Typography component="h2">Login/security</Typography>
            <p>Manage your password and signed-in devices.</p>
          </div>
        </div>
        <Divider />
        <div className="student-profile-page__security-details">
          <div>
            <span>Last login</span>
            <strong>
              {formatSecurityDate(
                profile.last_login_at,
                accountPreferences.language,
                accountPreferences.timezone,
              )}
            </strong>
          </div>
          <div>
            <span>Password last changed</span>
            <strong>
              {formatSecurityDate(
                profile.password_changed_at,
                accountPreferences.language,
                accountPreferences.timezone,
              )}
            </strong>
          </div>
        </div>
        <Divider />
        <div className="student-profile-page__security-subheading">
          <LockRoundedIcon />
          <div>
            <Typography component="h3">Change password</Typography>
            <span>Changing your password signs you out so you can sign in again securely.</span>
          </div>
        </div>
        {passwordError && <Alert severity="error">{passwordError}</Alert>}
        {passwordSuccess && <Alert severity="success">{passwordSuccess}</Alert>}
        <form className="student-profile-page__password-form" onSubmit={handlePasswordChange}>
          <TextField
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={passwordFields.currentPassword}
            onChange={(event) => setPasswordFields((current) => ({ ...current, currentPassword: event.target.value }))}
            required
            size="small"
          />
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            value={passwordFields.newPassword}
            onChange={(event) => setPasswordFields((current) => ({ ...current, newPassword: event.target.value }))}
            required
            size="small"
            helperText="At least 8 characters."
          />
          <TextField
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={passwordFields.confirmPassword}
            onChange={(event) => setPasswordFields((current) => ({ ...current, confirmPassword: event.target.value }))}
            required
            size="small"
          />
          <Button type="submit" variant="contained" disabled={passwordSaving}>
            {passwordSaving ? "Updating…" : "Update password"}
          </Button>
        </form>
        <Divider />
        <div className="student-profile-page__logout-all">
          <div className="student-profile-page__security-subheading">
            <DevicesRoundedIcon />
            <div>
              <Typography component="h3">Sign out everywhere</Typography>
              <span>End your session on this device and all other devices.</span>
            </div>
          </div>
          {securityError && <Alert severity="error">{securityError}</Alert>}
          {logoutAllConfirm ? (
            <div className="student-profile-page__logout-confirm">
              <span>This will sign you out on every device. Continue?</span>
              <Button
                color="error"
                variant="contained"
                onClick={handleLogoutAllDevices}
                disabled={logoutAllSaving}
              >
                {logoutAllSaving ? "Signing out…" : "Confirm sign out"}
              </Button>
              <Button onClick={() => setLogoutAllConfirm(false)} disabled={logoutAllSaving}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outlined"
              color="error"
              onClick={() => setLogoutAllConfirm(true)}
            >
              Logout from all devices
            </Button>
          )}
        </div>
      </Paper>
      )}
    </main>
  );
}
