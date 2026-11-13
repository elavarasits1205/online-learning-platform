
require("dotenv").config();

const supabase = require("./src/config/supabase");

async function testConnection() {
    const { data, error } = await supabase.storage.listBuckets();

    if (error) {
        console.error("Supabase connection failed:", error.message);
        process.exitCode = 1;
        return;
    }

    console.log("Supabase connection successful!");
    console.log("Available buckets:");

    data.forEach((bucket) => {
        console.log("-", bucket.name);
    });
}

testConnection().catch((error) => {
    console.error("Unexpected error:", error.message);
    process.exitCode = 1;
});
