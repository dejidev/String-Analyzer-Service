// index.js
const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.resolve(__dirname, "db.json");
const PORT = process.env.PORT || 3000;

const app = express();

app.use(bodyParser.json());


// Simple file-backed DB helpers 
function loadDB() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            fs.writeFileSync(DB_PATH, JSON.stringify({ strings: {} }, null, 2));
        }
        const raw = fs.readFileSync(DB_PATH, "utf8");
        return JSON.parse(raw);
    } catch (e) {
        console.error("Failed to load DB:", e);
        return { strings: {} };
    }
}
function saveDB(db) {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}


// --- Utility functions ----------------------------
function sha256Hex(value) {
    return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}
function isPalindrome(value) {
    const cleaned = value.toLowerCase();
    const reversed = cleaned.split("").reverse().join("");
    return cleaned === reversed;
}
function characterFrequencyMap(value) {
    const map = {};
    for (const ch of value) {
        map[ch] = (map[ch] || 0) + 1;
    }
    return map;
}
function analyzeString(value) {
    const hash = sha256Hex(value);
    const length = value.length;
    const unique_characters = new Set(value.split("")).size;
    const word_count = value.trim() === "" ? 0 : value.trim().split(/\s+/).length;
    const is_palindrome_flag = isPalindrome(value);
    const character_frequency_map = characterFrequencyMap(value);
    const created_at = new Date().toISOString();

    return {
        id: hash,
        value,
        properties: {
            length,
            is_palindrome: is_palindrome_flag,
            unique_characters,
            word_count,
            sha256_hash: hash,
            character_frequency_map
        },
        created_at
    };
}

// --- Missing middleware: add them here ----------------

// Middleware to ensure requests have JSON Content-Type
function requireJsonContent(req, res, next) {
    if (!req.is("application/json")) {
        return res.status(400).json({ message: "Content-Type must be application/json" });
    }
    next();
}

// Middleware to validate body.value exists and is a string
function validateStringValue(req, res, next) {
    if (!Object.prototype.hasOwnProperty.call(req.body, "value")) {
        return res.status(400).json({ message: 'Missing "value" field' });
    }
    if (typeof req.body.value !== "string") {
        return res.status(422).json({ message: '"value" must be a string' });
    }
    next();
}


// --- Endpoints ------------------------------------

// 1. Create/Analyze String
app.post("/strings", requireJsonContent, validateStringValue, (req, res) => {
    const { value } = req.body;
    // compute hash to use as ID
    const hash = sha256Hex(value);
    const db = loadDB();

    if (db.strings[hash]) {
        // Conflict: string already exists
        return res.status(409).json({ message: "String already exists in the system" });
    }

    const record = analyzeString(value);
    // store by hash
    db.strings[hash] = record;
    saveDB(db);

    return res.status(201).json(record);
});

// 2. Get Specific String by its raw value in path (we will accept exact match)
app.get("/strings/:string_value", (req, res) => {
    // decode path param (it may be URL encoded)
    const rawValue = req.params.string_value;
    // Note: path param could be path-escaped; express gives us decoded version.
    const hash = sha256Hex(rawValue);
    const db = loadDB();

    const record = db.strings[hash];
    if (!record) {
        return res.status(404).json({ message: "String does not exist in the system" });
    }
    return res.status(200).json(record);
});

// 3. Get All Strings with Filtering
// Query params: is_palindrome, min_length, max_length, word_count, contains_character
app.get("/strings", (req, res) => {
    const db = loadDB();
    let items = Object.values(db.strings);

    const filters_applied = {};

    // parse filters
    const { is_palindrome, min_length, max_length, word_count, contains_character } = req.query;

    if (typeof is_palindrome !== "undefined") {
        if (is_palindrome !== "true" && is_palindrome !== "false") {
            return res.status(400).json({ message: "is_palindrome must be true or false" });
        }
        const flag = is_palindrome === "true";
        items = items.filter(i => i.properties.is_palindrome === flag);
        filters_applied.is_palindrome = flag;
    }
    if (typeof min_length !== "undefined") {
        const n = Number(min_length);
        if (!Number.isInteger(n) || n < 0) {
            return res.status(400).json({ message: "min_length must be a non-negative integer" });
        }
        items = items.filter(i => i.properties.length >= n);
        filters_applied.min_length = n;
    }
    if (typeof max_length !== "undefined") {
        const n = Number(max_length);
        if (!Number.isInteger(n) || n < 0) {
            return res.status(400).json({ message: "max_length must be a non-negative integer" });
        }
        items = items.filter(i => i.properties.length <= n);
        filters_applied.max_length = n;
    }
    if (typeof word_count !== "undefined") {
        const n = Number(word_count);
        if (!Number.isInteger(n) || n < 0) {
            return res.status(400).json({ message: "word_count must be a non-negative integer" });
        }
        items = items.filter(i => i.properties.word_count === n);
        filters_applied.word_count = n;
    }
    if (typeof contains_character !== "undefined") {
        if (contains_character.length !== 1) {
            return res.status(400).json({ message: "contains_character must be a single character" });
        }
        const ch = contains_character;
        items = items.filter(i => Object.prototype.hasOwnProperty.call(i.properties.character_frequency_map, ch));
        filters_applied.contains_character = ch;
    }

    return res.status(200).json({
        data: items,
        count: items.length,
        filters_applied
    });
});

// 4. Natural Language Filtering
// Very small heuristic parser supporting a handful of example queries described in the task.
app.get("/strings/filter-by-natural-language", (req, res) => {
    const q = req.query.query;
    if (!q || typeof q !== "string" || q.trim() === "") {
        return res.status(400).json({ message: "query param is required" });
    }
    const original = q;
    const lower = q.toLowerCase();

    // Parsed filters object
    const parsed = {};

    // Heuristics:
    // - "single word" or "single-word" => word_count = 1
    if (/\bsingle[- ]?word\b/.test(lower) || /\bone[- ]word\b/.test(lower)) {
        parsed.word_count = 1;
    }
    // - "palindrom" (palindrome) => is_palindrome=true
    if (/\bpalindrom/.test(lower)) {
        parsed.is_palindrome = true;
    }
    // - "strings longer than N characters" -> min_length = N+1
    //   match "longer than X characters" or "longer than 10"
    const longerMatch = lower.match(/longer than (\d+)/);
    if (longerMatch) {
        parsed.min_length = Number(longerMatch[1]) + 1;
    }
    // - "longer than or equal to N" not supported explicitly; keep it simple
    // - "strings longer than 10 characters" also matched
    // - "strings containing the letter z" -> contains_character=z
    const containsMatch = lower.match(/contain(?:ing|s)? (?:the )?letter ([a-z0-9])/);
    if (containsMatch) {
        parsed.contains_character = containsMatch[1];
    } else {
        // fallback: 'containing the letter z' or 'strings containing z'
        const simpleContain = lower.match(/containing ([a-z0-9])/);
        if (simpleContain) parsed.contains_character = simpleContain[1];
    }

    // If we parsed nothing, return 400
    if (Object.keys(parsed).length === 0) {
        return res.status(400).json({ message: "Unable to parse natural language query" });
    }

    // Convert parsed filters into query-like call by reusing /strings logic
    // But check for conflicting filters (simple check)
    if (parsed.min_length !== undefined && parsed.max_length !== undefined) {
        if (parsed.min_length > parsed.max_length) {
            return res.status(422).json({ message: "Parsed filters conflict (min_length > max_length)" });
        }
    }

    // Apply filters to DB
    const db = loadDB();
    let items = Object.values(db.strings);

    if (parsed.is_palindrome !== undefined) {
        items = items.filter(i => i.properties.is_palindrome === parsed.is_palindrome);
    }
    if (parsed.word_count !== undefined) {
        items = items.filter(i => i.properties.word_count === parsed.word_count);
    }
    if (parsed.min_length !== undefined) {
        items = items.filter(i => i.properties.length >= parsed.min_length);
    }
    if (parsed.max_length !== undefined) {
        items = items.filter(i => i.properties.length <= parsed.max_length);
    }
    if (parsed.contains_character !== undefined) {
        const ch = parsed.contains_character;
        items = items.filter(i => Object.prototype.hasOwnProperty.call(i.properties.character_frequency_map, ch));
    }

    return res.status(200).json({
        data: items,
        count: items.length,
        interpreted_query: {
            original,
            parsed_filters: parsed
        }
    });
});

// 5. Delete String
app.delete("/strings/:string_value", (req, res) => {
    const rawValue = req.params.string_value;
    const hash = sha256Hex(rawValue);
    const db = loadDB();

    if (!db.strings[hash]) {
        return res.status(404).json({ message: "String does not exist in the system" });
    }

    delete db.strings[hash];
    saveDB(db);
    return res.status(204).send();
});

// Fallback 404
app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});



app.listen(PORT, () => {
    console.log(`String Analyzer Service listening on port ${PORT}`);
    console.log(`DB file at ${DB_PATH}`);
});
