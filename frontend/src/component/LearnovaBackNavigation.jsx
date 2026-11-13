import { Link as RouterLink } from "react-router-dom";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import LearnovaLogoMark from "./LearnovaLogoMark";
import "./LearnovaBackNavigation.scss";

export default function LearnovaBackNavigation({
  to = "/student/dashboard",
  brandTo = "/student/dashboard",
  label = "Back to dashboard",
  className = "",
}) {
  return (
    <nav
      className={`learnova-back-navigation ${className}`.trim()}
      aria-label="Page navigation"
    >
      <RouterLink
        className="learnova-back-navigation__arrow"
        to={to}
        aria-label={label}
        title={label}
      >
        <ArrowBackRoundedIcon />
      </RouterLink>
      <RouterLink
        className="learnova-back-navigation__brand"
        to={brandTo}
        aria-label="Learnova"
      >
        <LearnovaLogoMark
          className="learnova-back-navigation__mark"
          size="small"
        />
        <span>Learnova</span>
      </RouterLink>
    </nav>
  );
}
