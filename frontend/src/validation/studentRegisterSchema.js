
import * as yup from "yup";

const studentRegisterSchema = yup.object({
    firstName: yup
        .string()
        .trim()
        .required("First name is required.")
        .max(50, "First name must not exceed 50 characters."),

    lastName: yup
        .string()
        .trim()
        .required("Last name is required.")
        .max(50, "Last name must not exceed 50 characters."),

    email: yup
        .string()
        .trim()
        .email("Enter a valid email address.")
        .required("Email address is required.")
        .max(254, "Email address is too long."),

    phoneNumber: yup
        .string()
        .trim()
        .required("Phone number is required.")
        .matches(
            /^\d{6,15}$/,
            "Enter a valid phone number with 6 to 15 digits."
        ),

    // Institution selected from the public institutions API
    institutionId: yup
        .string()
        .required("Please select your college.")
        .matches(
            /^[1-9]\d*$/,
            "Select a valid college."
        ),

    // Student's college register number
    registerNumber: yup
        .string()
        .trim()
        .required("College register number is required.")
        .max(
            50,
            "Register number must not exceed 50 characters."
        )
        .matches(
            /^[a-zA-Z0-9/-]+$/,
            "Use only letters, numbers, hyphens, or slashes."
        ),

    referralCode: yup
        .string()
        .trim()
        .nullable()
        .max(30, "Referral code must not exceed 30 characters."),

    username: yup
        .string()
        .trim()
        .required("Username is required.")
        .min(3, "Username must contain at least 3 characters.")
        .max(30, "Username must not exceed 30 characters.")
        .matches(
            /^[a-zA-Z0-9_.-]+$/,
            "Use only letters, numbers, dots, underscores, or hyphens."
        ),

    dateOfBirth: yup
        .string()
        .nullable()
        .test(
            "valid-date",
            "Enter a valid date of birth.",
            (value) => !value || !Number.isNaN(Date.parse(value))
        )
        .test(
            "not-future",
            "Date of birth cannot be in the future.",
            (value) => !value || new Date(value) <= new Date()
        ),

    gender: yup
        .string()
        .oneOf(
            ["", "MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"],
            "Select a valid gender."
        ),

    password: yup
        .string()
        .required("Password is required.")
        .min(8, "Password must contain at least 8 characters.")
        .max(128, "Password must not exceed 128 characters."),

    confirmPassword: yup
        .string()
        .required("Please confirm your password.")
        .oneOf(
            [yup.ref("password")],
            "Passwords do not match."
        ),
});

export default studentRegisterSchema;
