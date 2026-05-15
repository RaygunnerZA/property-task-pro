# Filla Backend Architecture

This document outlines the backend logic structure and boundaries.

## Backend Folders (protected — domain logic)
- /services/**  
- /lib/**  
- /types/**  

These contain Supabase logic, domain services, AI pipelines, and data integrity functions. Do not change without reviewing `@Docs/` and migrations.

## Frontend / UI
- /components/filla/**
- /app/screens/**

## Responsibilities
- services/*  → data access + domain logic only
- hooks/*     → React state wrappers for services
- types/*     → shared DTOs and type definitions
- lib/*       → async utilities, errors, logging, prompts

