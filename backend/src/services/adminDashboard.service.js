const repository = require("../repositories/adminDashboard.repository");

async function getSummary() {
    return repository.getSummary();
}

async function getWidgets() {
    return repository.getWidgets();
}

module.exports = {
    getSummary,
    getWidgets
};
