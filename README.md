# My Store - Retail Management System

My Store is a modern full-stack retail management application built with Next.js 16, designed for small to medium-sized physical stores. It provides comprehensive management capabilities for products, inventory, employees, orders, procurement, and promotions.

## Features

### Core Modules

- **Authentication**: Login/logout and current user information management
- **Dashboard**: Aggregated business metrics and analytics
- **Product Management**: Full CRUD operations for products and categories
- **Inventory Management**: Stock queries, in/out records, and transfers
- **Order & Payment**: Complete order lifecycle management and payment status sync
- **Procurement & Suppliers**: Purchase order management and supplier maintenance
- **Employee & Permissions**: Employee information, role assignment, and session management
- **Attendance & Cashier**: Employee attendance tracking and cashier interface
- **Promotion Management**: Discount and promotion campaign configuration

### Technical Features

- Next.js 16 with App Router (SSR/SSG/ISR mixed architecture)
- TypeScript type safety
- Prisma ORM with PostgreSQL database
- Supabase for authentication and real-time capabilities
- Tailwind CSS for styling
- Responsive UI design

## Tech Stack

- **Frontend**: React 19.2.4 + Next.js 16.2.4
- **Backend**: Next.js API Routes (Node.js runtime)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS
- **Font**: Geist (via `next/font`)
- **Password Hashing**: bcryptjs
- **JWT Handling**: jose library

## Installation & Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables (see `.env.example`)
4. Run database migrations:
   ```bash
   npm run db:migrate
   ```
5. Generate Prisma client:
   ```bash
   npx prisma generate
   ```
6. Seed the database (optional):
   ```bash
   npm run db:seed
   ```
7. Start development server:
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:migrate` - Run database migrations
- `npm run db:push` - Push schema to database
- `npm run db:generate` - Generate Prisma client
- `npm run db:studio` - Open Prisma Studio
- `npm run db:seed` - Seed database with sample data

## Deployment

This application is designed for deployment on Vercel. When deploying to Vercel:

1. Ensure `DATABASE_URL` is set in your Vercel project settings
2. Update your build command to include Prisma generation:
   ```
   npx prisma generate && npm run build
   ```
3. Run database migrations after deployment (or set up automatic migration in your pipeline)

## Architecture

- **Server Components**: Support for Server Components with client hydration
- **Route Groups**: `(auth)` and `(dashboard)` directories for logical isolation and layout reuse
- **Middleware Authentication**: Authentication logic encapsulated in `lib/auth.ts`
- **Repository Pattern**: Prisma client instance management in `lib/prisma.ts`
- **API Routes as Controllers**: Each `route.ts` file corresponds to RESTful endpoints

## Prisma v7+ Specifics

This project follows Prisma v7+ best practices:

1. Enums are no longer imported from `@prisma/client` and are defined locally as string literal unions
2. The `tsconfig.json` excludes the `prisma` directory to prevent type checking errors
3. Explicit type declarations for all callback parameters to prevent implicit `any` errors
4. Proper handling of the Prisma client generation step in the build process

## Security Considerations

- Passwords are stored using bcryptjs salted hashing
- JWT tokens handled securely with the jose library
- All sensitive API routes must validate user sessions
- Environment variables used for sensitive configuration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is private and proprietary.
