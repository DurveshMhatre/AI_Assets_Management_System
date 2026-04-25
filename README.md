# AMS AI System

A comprehensive, full-stack Asset Management System (AMS) built to streamline inventory tracking, maintenance scheduling, and organizational workflows. 

## 🚀 Key Features

- **📦 Comprehensive Inventory Management:** Track assets, brands, and suppliers from procurement to decommissioning. Ensure accurate stock levels and asset lifecycles.
- **🔐 Role-Based Access Control (RBAC):** Secure user management and granular permission controls. Easily configure roles and define access to specific modules within the system.
- **📱 QR Code Integration:** Instantly generate and scan QR codes for quick asset lookups, simplifying auditing and day-to-day operations.
- **📊 Advanced Reporting:** Detailed unit reports and interactive dashboards. Gain actionable insights into asset allocation, maintenance costs, and system usage.
- **✍️ Digital Workflows:** Canvas-based digital signatures and pending approval workflows for robust accountability.
- **🔧 Maintenance Tracking:** Schedule, log, and monitor the maintenance lifecycle of physical assets to reduce downtime.

## 🛠️ Technology Stack

- **Backend:** Node.js, TypeScript, Express, Prisma ORM
- **Database:** PostgreSQL (with Redis for caching/sessions)
- **Frontend:** React, TypeScript, Vite
- **Deployment:** Docker support with `docker-compose`

## ⚙️ Getting Started

### Prerequisites
- Node.js
- Docker & Docker Compose (optional, for running the database services locally)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/DurveshMhatre/AI_Assets_Management_System.git
   cd AI_Assets_Management_System
   ```

2. **Start the Database Services**
   Using Docker, you can quickly spin up the required PostgreSQL and Redis instances:
   ```bash
   docker-compose up -d
   ```

3. **Backend Setup**
   ```bash
   cd backend
   npm install
   # Configure your .env file
   npx prisma migrate dev
   npm run dev
   ```

4. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   # Configure your .env file
   npm run dev
   ```

## 📝 License
This project is proprietary and confidential.
