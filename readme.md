# Aerotrack Control Center

An efficient, full-stack aviation asset tracking dashboard designed to monitor and manage active flight logs in real-time. Built with a responsive Bootstrap frontend and a robust Node.js/Express backend backed by a MongoDB database layer.

## Key Features

- Dynamic Asset Registry: Log flight profiles with immediate frontend updates.
- Operational Status Badges: Real-time status tags (On Schedule, Boarding, Delayed) stylized with color-coded UI pills.
- Data Purging Vector: Clean HTTP DELETE loop implementation to permanently remove records from the cluster.
- Persistent Storage: Mongoose-driven schema modeling connected to a local database system.

## Tech Stack

- Frontend: HTML5, JavaScript (Fetch API), Bootstrap 5 CSS framework
- Backend: Node.js, Express.js framework
- Database: MongoDB, Mongoose ODM

## Installation and Local Setup

1. Clone the Workspace:
git clone your-github-repo-url
cd aerotrack

2. Install Dependencies:
npm install

3. Configure the Environment:
Create a file named .env in the root folder and add your local MongoDB connection link string:
MONGO_URI=mongodb://127.0.0.1:27017/aerotrackSystem

4. Boot Up Engine:
node server.js

Open your browser and navigate to http://localhost:3000 to access the dashboard matrix.
