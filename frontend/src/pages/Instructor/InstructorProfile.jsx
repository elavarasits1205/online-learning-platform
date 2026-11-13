import { useEffect, useState } from "react";
import {
  Award,
  BriefcaseBusiness,
  Copy,
  Clock3,
  GraduationCap,
  Link2,
  Pencil,
  Share2,
  X,
} from "lucide-react";
import InputField from "../../component/fields/InputField";
import instructorApi from "../../service/InstructorApi";
import { getAuthUser } from "../../utils/authCookie";
import "./InstructorProfile.scss";

export default function InstructorProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [referralMessage, setReferralMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarImageFailed, setAvatarImageFailed] = useState(false);
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [draft, setDraft] = useState({});

  useEffect(() => () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
  }, [imagePreviewUrl]);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const response = await instructorApi.getMyProfile();
        const result = response.data?.data ?? response.data;

        if (active) {
          const nextProfile = result?.profile ?? result?.instructor ?? result;
          setProfile(nextProfile);
          setDraft({
            qualification: nextProfile?.qualification ?? "",
            specialization: nextProfile?.specialization ?? "",
            experienceYears: nextProfile?.experience_years ?? "",
            designation: nextProfile?.designation ?? "",
            bio: nextProfile?.bio ?? "",
            profileImageUrl: nextProfile?.profile_image_url ?? "",
          });
        }
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.message ||
              "Unable to load your instructor profile."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  function handleDraftChange(event) {
    const { name, value } = event.target;
    setDraft((current) => ({
      ...current,
      [name]: name === "experienceYears" && value !== "" && Number(value) < 0
        ? "0"
        : value,
    }));
  }

  function handleProfileImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Profile image must not exceed 5 MB.");
      event.target.value = "";
      return;
    }
    setError("");
    setProfileImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  }

  async function saveProfile(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      let profileImageUrl = draft.profileImageUrl || "";
      if (profileImageFile) {
        const uploadResponse = await instructorApi.uploadProfileImage(profileImageFile);
        const uploadData = uploadResponse.data?.data ?? uploadResponse.data;
        profileImageUrl = uploadData?.profileImageUrl ?? uploadData?.publicUrl ?? "";
        if (!profileImageUrl) throw new Error("The uploaded image URL was not returned.");
      }
      const payload = {
        qualification: draft.qualification.trim(),
        specialization: draft.specialization.trim(),
        designation: draft.designation.trim(),
        bio: draft.bio.trim(),
        profileImageUrl: profileImageUrl.trim(),
      };
      if (draft.experienceYears !== "") {
        if (!Number.isInteger(Number(draft.experienceYears)) || Number(draft.experienceYears) < 0 || Number(draft.experienceYears) > 80) {
          setError("Years of experience must be a whole number from 0 to 80.");
          setSaving(false);
          return;
        }
        payload.experienceYears = Number(draft.experienceYears);
      }
      const response = await instructorApi.updateMyProfile(payload);
      const body = response.data?.data ?? response.data;
      const updated = body?.profile ?? body?.instructor ?? body;
      setProfile(updated);
      setAvatarImageFailed(false);
      setProfileImageFile(null);
      setImagePreviewUrl("");
      setDraft({
        qualification: updated.qualification ?? "",
        specialization: updated.specialization ?? "",
        experienceYears: updated.experience_years ?? "",
        designation: updated.designation ?? "",
        bio: updated.bio ?? "",
        profileImageUrl: updated.profile_image_url ?? "",
      });
      setEditing(false);
      setSuccess("Profile updated successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="professional-profile"><p>Loading your professional profile...</p></main>;
  }

  if (error && !profile) {
    return (
      <main className="professional-profile">
        <h1>Professional Instructor Profile</h1>
        <p className="profile-error">{error}</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="professional-profile">
        <h1>Professional Instructor Profile</h1>
        <p>No instructor profile data was returned by the server.</p>
      </main>
    );
  }

 const storedUser = getAuthUser();

const user = profile.user ?? profile;

const fullName =
  [user.first_name, user.last_name].filter(Boolean).join(" ") ||
  user.full_name ||
  profile.full_name ||
  user.name ||
  profile.name ||
  user.username ||
  storedUser?.full_name ||
  [storedUser?.first_name, storedUser?.last_name]
    .filter(Boolean)
    .join(" ") ||
  storedUser?.name ||
  storedUser?.username ||
  "Instructor";


  const email = profile.email || user.email;
  const biography =
    profile.bio || profile.biography || profile.about_me;
  const qualification =
    profile.qualification ||
    profile.qualifications ||
    profile.education;
  const expertise =
    profile.expertise ||
    profile.areas_of_expertise ||
    profile.specialization;
  const headline =
    profile.headline ||
    profile.professional_title ||
    profile.designation;
  const experience =
    profile.years_of_experience ??
    profile.experience_years;
  const referralCode = profile.referral_code || profile.referralCode || "";
  const referralLink = referralCode
    ? `${window.location.origin}/register/student?ref=${encodeURIComponent(referralCode)}`
    : "";
  const avatarText = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const profileImageUrl =
    profile.profile_image_url ||
    profile.profileImageUrl ||
    user.profile_image_url ||
    user.profileImageUrl ||
    "";
  const completionFields = [
    biography,
    qualification,
    expertise,
    headline,
    experience,
  ];
  const completedFields = completionFields.filter(
    (value) => value !== undefined && value !== null && String(value).trim() !== ""
  ).length;
  const profileCompletion = Math.round(
    (completedFields / completionFields.length) * 100
  );

  function display(value) {
    if (value === null || value === undefined || value === "") {
      return "Not provided";
    }

    if (Array.isArray(value)) return value.join(", ");
    return String(value);
  }

  async function copyReferralValue(value, message) {
    try {
      await navigator.clipboard.writeText(value);
      setReferralMessage(message);
    } catch {
      setReferralMessage("Copy is unavailable in this browser. Select and copy the value above.");
    }
  }

  async function shareReferralLink() {
    if (!referralCode) return;
    const shareText = `Register on Learnova with my instructor referral code ${referralCode} and get your course discount.`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Instructor referral code",
          text: shareText,
          url: referralLink,
        });
        setReferralMessage("Referral code shared.");
      } catch (shareError) {
        if (shareError.name !== "AbortError") {
          setReferralMessage("Unable to share the referral code.");
        }
      }
      return;
    }

    await copyReferralValue(shareText, "Referral instructions copied.");
  }

  return (
    <main className="professional-profile">
      <header className="professional-profile-header">
        <div>
          <span className="profile-eyebrow">INSTRUCTOR WORKSPACE</span>
          <h1>Instructor profile</h1>
          <p>Your professional background, qualifications and teaching expertise.</p>
        </div>
        <button type="button" className="professional-profile-edit" onClick={() => {
          setError("");
          setSuccess("");
          if (editing) {
            setProfileImageFile(null);
            setImagePreviewUrl("");
          } else {
            setDraft({
              qualification: profile.qualification ?? "",
              specialization: profile.specialization ?? "",
              experienceYears: profile.experience_years ?? "",
              designation: profile.designation ?? "",
              bio: profile.bio ?? "",
              profileImageUrl: profileImageUrl,
            });
            setProfileImageFile(null);
            setImagePreviewUrl("");
          }
          setEditing((value) => !value);
        }}>
          {editing ? <><X size={16} /> Cancel editing</> : <><Pencil size={16} /> Edit profile</>}
        </button>
      </header>

      {success && <p className="profile-success" role="status">{success}</p>}
      {error && <p className="profile-error" role="alert">{error}</p>}

      <section className="professional-identity" aria-label="Instructor identity">
        <div className="professional-identity-main">
          <div className="professional-avatar" role="img" aria-label={`${fullName} profile picture`}>
            {(editing && imagePreviewUrl ? imagePreviewUrl : profileImageUrl) && !avatarImageFailed ? (
              <img src={editing && imagePreviewUrl ? imagePreviewUrl : profileImageUrl} alt="" onError={() => setAvatarImageFailed(true)} />
            ) : (
              <span aria-hidden="true">{avatarText || "I"}</span>
            )}
          </div>
          <div className="professional-identity-details">
            <span className="professional-role"><Award size={14} /> Instructor</span>
            <h2>{fullName}</h2>
            <p>{headline || "Add a professional headline to introduce your expertise."}</p>
            {email && <span className="professional-email">{email}</span>}
          </div>
        </div>
        <div className="profile-completion">
          <div className="profile-completion-heading">
            <span>Profile completeness</span>
            <strong>{profileCompletion}%</strong>
          </div>
          <div className="profile-completion-track" role="progressbar" aria-valuenow={profileCompletion} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completeness">
            <span style={{ width: `${profileCompletion}%` }} />
          </div>
          <small>{profileCompletion === 100 ? "Your professional profile is complete." : "Add your experience and expertise to strengthen your profile."}</small>
        </div>
      </section>

      <section className="professional-details">
        <div className="professional-section-heading">
          <h2>Professional Overview</h2>
          <p>Share your teaching background and areas of expertise with learners.</p>
        </div>

        {editing ? (
          <form className="professional-profile-form" onSubmit={saveProfile}>
            <div className="professional-form-intro">
              <strong>Professional information</strong>
              <span>Keep these details current so learners know what you teach.</span>
            </div>
            <InputField name="qualification" label="Qualification" value={draft.qualification} onChange={handleDraftChange} disabled={saving} />
            <InputField name="specialization" label="Area of expertise" value={draft.specialization} onChange={handleDraftChange} disabled={saving} />
            <InputField name="experienceYears" label="Years of experience" type="number" value={draft.experienceYears} onChange={handleDraftChange} inputProps={{ min: 0, max: 80, step: 1 }} disabled={saving} />
            <InputField name="designation" label="Professional headline" value={draft.designation} onChange={handleDraftChange} disabled={saving} />
            <label className="profile-image-upload">
              <span>Profile picture</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleProfileImageChange} disabled={saving} />
              <small>JPEG, PNG, or WebP. Maximum size 5 MB.</small>
            </label>
            <InputField name="bio" label="About me" value={draft.bio} onChange={handleDraftChange} multiline rows={4} disabled={saving} />
            <div className="professional-profile-form-actions">
              <button type="submit" disabled={saving}>{saving ? "Saving profile…" : "Save changes"}</button>
              <button type="button" disabled={saving} onClick={() => {
                setProfileImageFile(null);
                setImagePreviewUrl("");
                setEditing(false);
              }}>Cancel</button>
            </div>
          </form>
        ) : (
        <div className="professional-detail-grid">
          <article className="professional-detail-card full-width">
            <span className="detail-label"><BriefcaseBusiness size={16} /> About me</span>
            <p>{display(biography)}</p>
          </article>

          <article className="professional-detail-card">
            <span className="detail-label"><GraduationCap size={16} /> Qualifications</span>
            <p>{display(qualification)}</p>
          </article>

          <article className="professional-detail-card">
            <span className="detail-label"><Award size={16} /> Areas of expertise</span>
            <p>{display(expertise)}</p>
          </article>

          <article className="professional-detail-card">
            <span className="detail-label"><BriefcaseBusiness size={16} /> Professional headline</span>
            <p>{display(headline)}</p>
          </article>

          <article className="professional-detail-card">
            <span className="detail-label"><Clock3 size={16} /> Teaching experience</span>
            <p>
              {experience === undefined || experience === null || experience === ""
                ? "Not provided"
                : `${experience} ${Number(experience) === 1 ? "year" : "years"}`}
            </p>
          </article>

          <article className="professional-detail-card full-width referral-card">
            <div className="referral-card-heading">
              <span className="referral-heading-icon" aria-hidden="true"><Link2 size={19} /></span>
              <div>
                <span className="referral-eyebrow">INSTRUCTOR REFERRALS</span>
                <h3>Invite learners to Learnova</h3>
                <p>Share your referral code or link so learners can find your courses.</p>
              </div>
            </div>
            {referralCode ? (
              <div className="referral-content">
                <div className="referral-values">
                  <div className="referral-value-panel referral-code-panel">
                    <span className="referral-field-label">Your referral code</span>
                    <code className="referral-code-value">{referralCode}</code>
                  </div>
                  <div className="referral-value-panel referral-link-panel">
                    <span className="referral-field-label">Your personal referral link</span>
                    <div className="referral-link-value">
                      <Link2 size={15} aria-hidden="true" />
                      <span title={referralLink}>{referralLink}</span>
                    </div>
                  </div>
                </div>
                <div className="referral-actions">
                  <button
                    type="button"
                    className="referral-action-button referral-action-secondary"
                    onClick={() => copyReferralValue(referralCode, "Referral code copied.")}
                  >
                    <Copy size={15} aria-hidden="true" />
                    Copy code
                  </button>
                  <button
                    type="button"
                    className="referral-action-button referral-action-secondary"
                    onClick={() => copyReferralValue(referralLink, "Referral link copied.")}
                  >
                    <Copy size={15} aria-hidden="true" />
                    Copy link
                  </button>
                  <button
                    type="button"
                    className="referral-action-button referral-action-primary"
                    onClick={shareReferralLink}
                  >
                    <Share2 size={15} aria-hidden="true" />
                    Share referral link
                  </button>
                </div>
              </div>
            ) : (
              <p className="referral-empty-state">
                Your referral code will appear here after your account is approved.
              </p>
            )}
            {referralMessage && (
              <p className="referral-feedback" role="status">
                {referralMessage}
              </p>
            )}
          </article>
        </div>
        )}
      </section>
    </main>
  );
}
