# String Analyzer Service (Stage 1)

Simple REST API that analyzes strings and stores computed properties.

## Stack
- Node.js (>=16)
- Express
- File-backed JSON DB (`db.json`) for simple persistence (suitable for Stage 1 / demo)

## Endpoints

1. **Create / Analyze string**
   - `POST /strings`
   - Body: `{ "value": "string to analyze" }`
   - Responses:
     - `201 Created`: returns analyzed object
     - `409 Conflict`: string already exists
     - `400 Bad Request`: missing JSON or missing value
     - `422 Unprocessable Entity`: value must be string

2. **Get specific string**
   - `GET /strings/{string_value}`
   - `200 OK` → analyzed object
   - `404 Not Found` → not found

3. **Get all strings with filters**
   - `GET /strings?is_palindrome=true&min_length=5&max_length=20&word_count=2&contains_character=a`
   - `200 OK` → `{ data: [...], count, filters_applied }`

4. **Natural Language Filtering**
   - `GET /strings/filter-by-natural-language?query=all%20single%20word%20palindromic%20strings`
   - Returns `{ data, count, interpreted_query }`
   - Supported heuristics (examples):
     - "single word" → `word_count=1`
     - "palindrom" → `is_palindrome=true`
     - "strings longer than 10 characters" → `min_length=11`
     - "strings containing the letter z" → `contains_character=z`

5. **Delete string**
   - `DELETE /strings/{string_value}`
   - `204 No Content` on success
   - `404 Not Found` if not present

## Run locally

1. Clone repo
2. `npm install`
3. `npm start`
4. Server runs on `http://localhost:3000` by default.

A `db.json` file will be created automatically and contains stored strings keyed by their sha256 hash.

## Example curl tests

Create a string:
```bash
curl -X POST http://localhost:3000/strings \
  -H "Content-Type: application/json" \
  -d '{"value": "racecar"}'
# String-Analyzer-Service
