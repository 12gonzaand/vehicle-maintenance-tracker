# Prompt: Vehicle Maintenance Tracker Web App

Build a self-hosted web app for tracking maintenance on my personal vehicles. This will run on my home Ubuntu server alongside my other self-hosted services.

## Core Requirements

**Vehicles**
- Support multiple vehicle profiles (e.g., truck, car), each with: name/nickname, year, make, model, VIN (optional), current mileage, and a photo (optional).
- Ability to add, edit, and archive/delete vehicles.

**Service Records**
- Each vehicle has its own list of service records.
- Each service record should capture:
  - Service type (e.g., oil change, tire rotation, brake pads, registration) — support both a preset dropdown list and freeform custom entries
  - Date performed
  - Mileage at time of service
  - Cost
  - Notes/description (freeform text)
  - Shop/location performed (optional, e.g., "self" vs a shop name)
  - One or more uploaded files (receipts, invoices) attached to that specific record
- Records should be viewable in a sortable/filterable list per vehicle (by date, mileage, or service type).

**File Uploads**
- Support uploading images (jpg/png) and PDFs as receipts.
- Store files on the server's local filesystem, organized by vehicle/record (not just dumped in one folder).
- Show thumbnail previews for images and a simple link/icon for PDFs.
- Allow downloading or viewing the original file later.

**Mileage Tracking**
- Track mileage history over time per vehicle (derived from service records, plus optional standalone mileage log entries even without a service).
- Show a simple view of mileage progression (table is fine; a basic chart is a nice-to-have, not required).

**Maintenance Reminders (nice-to-have, not required for v1)**
- Optionally flag upcoming service based on mileage or time intervals (e.g., "oil change every 5,000 miles" per vehicle/service type).

## Tech Stack Preferences
- Backend: Node.js + Express
- Database: SQLite (single file, easy to back up, fits my server setup)
- Frontend: Keep it simple — server-rendered pages or a lightweight frontend (no heavy build pipeline needed). Plain HTML/CSS/vanilla JS or a minimal framework is fine.
- File storage: local filesystem under a configurable uploads directory
- No cloud dependencies — everything should run fully offline on my local network
- No authentication needed — this will only be accessible via Tailscale on my private network, so network-level access control is sufficient

## Deliverables
1. A clear project structure (routes, models, views/templates, uploads folder)
2. Database schema (vehicles, service_records, service_files tables at minimum)
3. Basic CRUD UI for vehicles and service records
4. File upload handling with validation (file type/size limits)
5. A README with setup instructions (npm install, env vars, how to run, how to back up the SQLite file and uploads folder)

## Out of Scope for v1
- Multi-user accounts with permissions
- Mobile app (responsive web is enough)
- Integration with any external car APIs (VIN decoding, etc.) — can revisit later

Please start by proposing the database schema and folder structure before writing code, so I can confirm the approach.
