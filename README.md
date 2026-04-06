# Peptide Ecommerce Application

This is the monorepo for the ecommerce application. It is completely unlinked from any previous repositories and is ready for your specific backend and frontend deployments.

## Directory Structure
- `/nodejs-api`: The backend Express/Prisma API
- `/nextjs-frontend`: The frontend Next.js App Router application

## Development
To run this application locally, you will need to start both servers. Ensure that your PostgreSQL database is running and the credentials in `nodejs-api/.env` match.

### Running Backend API
```bash
cd nodejs-api
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
# Running on http://localhost:5001
```

### Running Frontend App
```bash
cd nextjs-frontend
npm install
npm run dev
# Running on http://localhost:3000
```
