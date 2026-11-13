import * as yup from "yup";

const loginSchema = yup.object({
    identifier: yup
        .string()
        .trim()
        .required("Username or email is required.")
        .max(254, "Username or email is too long."),

    password: yup
        .string()
        .required("Password is required.")
        .max(128, "Password must not exceed 128 characters."),
});

export default loginSchema;
