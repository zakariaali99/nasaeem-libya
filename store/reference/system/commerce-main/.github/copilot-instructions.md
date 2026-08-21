# E-commerce Project Specifications

## Overview
This project is an e-commerce platform built using Next.js, Drizzle ORM, PostgreSQL, Better-Auth, and React. The design will be modular to ensure ease of extension and modification, maintaining a decoupled architecture.

## IMPORTANT
Make sure that all user facing text is in arabic and that the UI layout is RTL. Also we want to design all the UI to be mobile-first.

We'll also be using shadcn to speed up the frontend development. Please note that the commands for shadcn start with ```npx shadcn@latest```

## Technologies
- **Next.js**: A React framework for server-side rendering and static site generation.
- **Drizzle ORM**: A lightweight TypeScript ORM for PostgreSQL.
- **PostgreSQL**: A powerful, open-source relational database system.
- **Better-Auth**: An authentication library for secure user management.
- **React**: A JavaScript library for building user interfaces.
- **Redis**: Redis will be used as a caching layer to improve the performance of our ecommerce platform. By storing frequently accessed data in Redis, we can reduce the load on our primary database and speed up response times for users. Additionally, Redis will be utilized for session management, ensuring that user sessions are stored efficiently and can be quickly retrieved. This will enhance the overall user experience by providing faster page loads and more responsive interactions.
- **Formik**: A library for building forms in React with ease.
- **TanStack Query**: A library for fetching, caching, and updating data in React applications.
- **Redux**: A predictable state container for JavaScript apps.
- **Zod**: A TypeScript-first schema declaration and validation library.
- **ioredis**: A robust, full-featured Redis client for Node.js.

## Project Structure
The project will follow a modular design pattern, with each module responsible for a specific feature or functionality. This will ensure that the codebase remains maintainable and scalable.

### Modules
1. **User Management**
    - Registration
    - Login/Logout
    - Profile Management
    - Authentication (using Better-Auth)
User registeration will be done using phone number and password only

2. **Product Management**
    - Product Listing
    - Product Details
    - Inventory Management
    - Product Variants: Products will have variants with images and quantities separate for each variant.

3. **Order Management**
    - Cart: We will use Redis for the cart functionality to enhance performance and ensure efficient session management. Redis, being an in-memory data store, allows for quick read and write operations, which is crucial for a responsive user experience when managing shopping carts. By storing cart data in Redis, we can reduce the load on our primary database and provide faster access to cart information. Additionally, Redis will help in maintaining user sessions, ensuring that cart data is consistently available and quickly retrievable across different user interactions.
    - Checkout
    - Order History
    - Shipping: Orders will have a shipping status to track the progress of the shipment.

4. **Payment Integration**
    - Payment Gateway Integration
    - Order Confirmation

## Discounts
- Product-wide discounts: Apply discounts on individual product prices.
- Order-wide discounts: Apply discounts on the entire order.
- Special deals: Support promotions such as BOGO (Buy One Get One) and similar offers.

## Regional Delivery & Discounts
- Predefined LIBYA regions: Define cities and within each city, specify areas or places.
- Custom delivery pricing: Set specific delivery costs for each region.
- Regional discounts: Enable discount rules specific to selected regions.
- Customer selection: Allow customers to choose their exact delivery region.

5. **Admin Dashboard**
    - User Management
    - Product Management
    - Order Management
    - Inventory Management
    - Homepage Customization: Admins can customize the homepage using a visual designer with React Page, allowing them to create and arrange widgets without much work from the development team.

## Database Schema
The database schema will be designed using PostgreSQL, with Drizzle ORM handling the database operations. The schema will include tables for users, products, orders, payments, and shipping statuses.

## Authentication
Better-Auth will be used to handle user authentication, ensuring secure login and registration processes. Token-based authentication will be implemented for session management.

## Frontend
The frontend will be built using React and Next.js, providing a responsive and dynamic user interface. Server-side rendering and static site generation will be utilized for optimal performance.

## Extensibility
The modular design will allow for easy addition of new features and modifications. Each module will be self-contained, with clear interfaces for interaction with other modules.

## Deployment
The application will be containerized using Docker for consistent deployment across different environments. CI/CD pipelines will be set up for automated testing and deployment.

## Testing and Performance

To ensure our application is production-ready, we will utilize the following testing packages:

- **Jest**: A robust testing framework for unit and integration tests with zero configuration and fast execution.
- **React Testing Library**: Enables testing of React components with a focus on user interaction and minimal implementation details.
- **Cypress**: An end-to-end testing tool that provides a fast, reliable, and easy setup for comprehensive browser tests.
- **k6**: A modern load testing tool for stress testing our backend and frontend, ensuring optimal performance under high traffic.

## Conclusion
This e-commerce project will be a robust, scalable, and maintainable platform, leveraging modern technologies and best practices in web development.
