-- Add owner and contact columns to properties table

-- Add owner columns
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS owner_name TEXT;

ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS owner_email TEXT;

-- Add contact columns
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS contact_name TEXT;

ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS contact_email TEXT;

ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS contact_phone TEXT;

