const NodeHelper = require("node_helper");

module.exports = NodeHelper.create({
    start: function () {
        console.log("Starting node_helper for MMM-evcc-SolarYield");
    },

    socketNotificationReceived: async function (notification, payload) {
        if (notification === "GET_SOLAR_DATA") {
            // Dynamically import node-fetch when needed
            const fetch = (await import("node-fetch")).default;
            const apiUrl = payload.api_url;
            fetch(apiUrl)
                .then(res => res.json())
                .then(data => {
                    this.sendSocketNotification("SOLAR_DATA", data);
                })
                .catch(err => {
                    this.sendSocketNotification("SOLAR_DATA_ERROR", err.message);
                });
        }
    }
});