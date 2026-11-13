
// src/component/buttons/Button.jsx

import React from "react";
import {
  Button as MuiButton,
  CircularProgress,
} from "@mui/material";
import "./Button.css";

const Button = ({
  children,
  label,
  variant = "contained",
  color = "primary",
  size = "medium",
  type = "button",
  fullWidth = false,
  disabled = false,
  loading = false,
  startIcon,
  endIcon,
  onClick,
  sx = {},
  className = "",
  ...rest
}) => {
  return (
    <MuiButton
  type={type}
  variant={variant}
  color={color}
  size={size}
  fullWidth={fullWidth}
  disabled={disabled || loading}
  startIcon={!loading ? startIcon : undefined}
  endIcon={!loading ? endIcon : undefined}
  onClick={onClick}
  className={[
    "olp-button",
    `olp-button--${size}`,
    fullWidth ? "olp-button--full-width" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ")}
  sx={{
    textTransform: "none",
    fontWeight: 600,
    borderRadius: 2,
    minHeight: 40,
    ...sx,
  }}
  {...rest}
>
  {loading ? (
    <span className="olp-button__loader">
      <CircularProgress size={20} color="inherit" />
    </span>
  ) : (
    children ?? label
  )}
</MuiButton>
  );
};

export default Button;
