# Souvenote Backend Plan

## Current Goal
Build the backend and database foundation while frontend direction is being finalized.

## Backend Priorities
1. Create PostgreSQL database schema
2. Add pricing catalog seed data
3. Set up NestJS backend
4. Add health check endpoint
5. Add pricing catalog endpoint
6. Add credit ledger logic
7. Add mock AI generation flow
8. Add upload and order API contracts

## MVP Rules
- All AI provider calls should support mock mode first.
- No secrets, API keys, or credentials should be committed.
- Credit grants, deductions, and refunds must go through the credit ledger.
- Backend responses should be documented before frontend fetch calls depend on them.
