const bcrypt =
    require("bcrypt");

const {
    bcrypt: bcryptConfig
} = require("../config/auth");


// ============================================================
// HASH PASSWORD
// ============================================================

async function hashPassword(password) {

    return bcrypt.hash(
        password, 
        bcryptConfig.saltRounds
    );
}


// ============================================================
// COMPARE PASSWORD
// ============================================================

async function comparePassword(
    password,
    passwordHash
) {

    return bcrypt.compare(
        password,
        passwordHash
    );
}


module.exports = {

    hashPassword,

    comparePassword
};