const bcrypt = require("bcryptjs");

async function test() {
    const password = "Admin@123";

    const hash = "$2b$12$ifYjSBBTkjhUAfE5zQCSMOEdrDqoVbouWWVOSoK0r/fR.Ef.RTRTu";

    const result = await bcrypt.compare(password, hash);

    console.log("Password matches:", result);
}

test();