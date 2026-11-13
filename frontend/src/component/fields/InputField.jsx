// src/component/fields/InputField.jsx

import React from "react";
import {
  TextField,
  MenuItem,
  ListSubheader,
  InputAdornment,
} from "@mui/material";
import "./InputField.css";

const InputField = ({
  name,
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  variant = "outlined",
  size = "medium",
  fullWidth = true,
  required = false,
  disabled = false,
  readOnly = false,
  error = false,
  helperText = "",
  placeholder = "",
  options = [],
  multiline = false,
  rows = 3,
  minRows,
  maxRows,
  select = false,
  startAdornment,
  endAdornment,
  sx = {},
  className = "",
  autoComplete,
  ...rest
}) => {
  const isSelect = select || type === "select";

  const inputSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: 2,
    },
    ...sx,
  };

  return (
    <TextField
      name={name}
      label={label}
      value={value ?? ""}
      onChange={onChange}
      onBlur={onBlur}
      type={isSelect ? undefined : type}
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      required={required}
      disabled={disabled}
      error={Boolean(error)}
      helperText={helperText || undefined}
      placeholder={placeholder}
      select={isSelect}
      multiline={multiline}
      rows={multiline ? rows : undefined}
      minRows={multiline ? minRows : undefined}
      maxRows={multiline ? maxRows : undefined}
      autoComplete={autoComplete}
className={`olp-input-field ${className}`.trim()} sx={inputSx}
      slotProps={{
        input: {
          readOnly,
          startAdornment: startAdornment ? (
            <InputAdornment position="start">
              {startAdornment}
            </InputAdornment>
          ) : undefined,
          endAdornment: endAdornment ? (
            <InputAdornment position="end">
              {endAdornment}
            </InputAdornment>
          ) : undefined,
        },
      }}
      {...rest}
    >
      {isSelect &&
        options.map((option) => {
          if (Array.isArray(option?.options)) {
            return [
              <ListSubheader key={`group-${option.label}`}>
                {option.label}
              </ListSubheader>,
              ...option.options.map((value) => (
                <MenuItem key={`${option.label}-${value}`} value={value}>
                  {value}
                </MenuItem>
              )),
            ];
          }

          const optionValue =
            typeof option === "object" ? option.value : option;
          const optionLabel =
            typeof option === "object" ? option.label : option;

          return (
            <MenuItem key={optionValue} value={optionValue}>
              {optionLabel}
            </MenuItem>
          );
        })}
    </TextField>
  );
};

export default InputField;
