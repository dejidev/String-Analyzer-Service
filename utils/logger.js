// ======================================================================
// 📁 utils/logger.js
// A lightweight, colorful logger utility for Node.js apps
// ======================================================================

const fs = require("fs");
const path = require("path");

// Ensure logs folder exists
const LOG_DIR = path.join(__dirname, "..", "logs");
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Helper for timestamp formatting
function getTimestamp() {
    return new Date().toISOString().replace("T", " ").replace("Z", "");
}

// Color codes for terminal output
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    fg: {
        red: "\x1b[31m",
        green: "\x1b[32m",
        yellow: "\x1b[33m",
        blue: "\x1b[34m",
        magenta: "\x1b[35m",
        cyan: "\x1b[36m",
        white: "\x1b[37m",
    },
};

// Generic logger function
function logToConsoleAndFile(level, message, data = null) {
    const timestamp = getTimestamp();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    const fullMessage = data ? `${logMessage}\n${JSON.stringify(data, null, 2)}` : logMessage;

    // Determine color
    let color;
    switch (level) {
        case "error":
            color = colors.fg.red;
            break;
        case "warn":
            color = colors.fg.yellow;
            break;
        case "info":
            color = colors.fg.cyan;
            break;
        case "success":
            color = colors.fg.green;
            break;
        default:
            color = colors.fg.white;
    }

    // Print to console
    console.log(`${color}${fullMessage}${colors.reset}`);

    // Write to file (rotated daily)
    const fileName = path.join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.log`);
    fs.appendFileSync(fileName, fullMessage + "\n", "utf8");
}

// Exported API
module.exports = {
    info: (msg, data) => logToConsoleAndFile("info", msg, data),
    success: (msg, data) => logToConsoleAndFile("success", msg, data),
    warn: (msg, data) => logToConsoleAndFile("warn", msg, data),
    error: (msg, data) => logToConsoleAndFile("error", msg, data),
};
