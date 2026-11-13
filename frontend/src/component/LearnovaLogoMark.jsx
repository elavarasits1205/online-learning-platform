import "./LearnovaLogoMark.scss";

export default function LearnovaLogoMark({ className = "", size = "medium" }) {
  const sizeClass = size === "medium" ? "" : `learnova-logo-mark--${size}`;
  const classes = ["learnova-logo-mark", sizeClass, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} aria-hidden="true">
      L
    </span>
  );
}
