
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
        "SUPABASE_URL and SUPABASE_SECRET_KEY must be configured in .env"
    );
}

const supabase = createClient(
    supabaseUrl,
    supabaseSecretKey
);

module.exports = supabase;
