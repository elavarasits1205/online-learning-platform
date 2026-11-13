import * as yup from "yup";

const instructorRegisterSchema = yup.object({
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
            /^\d{10}$/,
            "Enter exactly 10 digits for the phone number."
        ),

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

    qualification: yup
        .string()
        .trim()
        .required("Qualification is required.")
        .max(150, "Qualification must not exceed 150 characters."),

    specialization: yup
        .string()
        .trim()
        .required("Specialization is required.")
        .max(150, "Specialization must not exceed 150 characters."),

    experienceYears: yup
        .number()
        .transform((value, originalValue) =>
            originalValue === "" || originalValue == null
                ? null
                : value
        )
        .nullable()
        .typeError("Experience must be a valid number.")
        .integer("Experience must be a whole number.")
        .min(0, "Experience cannot be negative.")
        .max(80, "Experience must not exceed 80 years."),

    designation: yup
        .string()
        .trim()
        .max(100, "Designation must not exceed 100 characters."),

    bio: yup
        .string()
        .trim()
        .max(1000, "Bio must not exceed 1000 characters."),

    password: yup
        .string()
        .required("Password is required.")
        .min(8, "Password must contain at least 8 characters.")
        .max(128, "Password must not exceed 128 characters."),

    confirmPassword: yup
        .string()
        .required("Please confirm your password.")
        .oneOf([yup.ref("password")], "Passwords do not match."),
});

export default instructorRegisterSchema;
