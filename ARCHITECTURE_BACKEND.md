# Filla Backend Architecture

This document outlines the backend logic structure and boundaries.

## Backend Folders (Do Not Modify in Lovable)
- /services/**  
- /lib/**  
- /types/**  

These contain Supabase logic, domain services, AI pipelines, and data integrity functions.

## Frontend / UI (Lovable may modify)
- /components/filla/**
- /app/screens/**

## Responsibilities
- services/*  → data access + domain logic only
- hooks/*     → React state wrappers for services
- types/*     → shared DTOs and type definitions
- lib/*       → async utilities, errors, logging, prompts

