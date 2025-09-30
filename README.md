📊 Excel Data Visualization Platform

A powerful full-stack platform for uploading Excel files (.xls or .xlsx), analyzing the data, and generating interactive 2D and 3D charts. Users can choose axes from column headers, select chart types, and export/download graphs. The platform also provides history tracking, user management, and optional AI-powered insights.

🚀 Features

Excel Upload: Upload and process .xls or .xlsx files.

Data Visualization: Generate interactive 2D & 3D charts.

Custom Controls: Choose X & Y axes dynamically from column headers.

Download Graphs: Export visualizations as images or reports.

User Dashboard: View history of uploads & analysis.

Admin Panel: Manage users and track data usage.

AI Integration (Optional): Get smart insights and summary reports from uploaded data.

🛠️ Tech Stack

Frontend: React.js (with Tailwind CSS / shadcn UI for styling)

Backend: Node.js + Express.js

Database: MongoDB / PostgreSQL (choose as per deployment)

File Parsing: xlsx (Node.js library for Excel processing)

Charts: Recharts / Chart.js / Three.js (for 3D)

Authentication: JWT-based login & role-based access (user/admin)

AI Insights (Optional): OpenAI API or similar
📦 excel-viz-platform
 ┣ 📂 backend          # Node.js + Express server
 ┣ 📂 frontend         # React.js application
 ┃ ┣ 📂 components
 ┃ ┃ ┣ 📜 Charts.jsx
 ┃ ┃ ┣ 📜 Controls.jsx
 ┃ ┃ ┗ 📜 History.jsx
 ┣ 📜 package.json
 ┣ 📜 README.md
 ┗ 📜 .gitignore
