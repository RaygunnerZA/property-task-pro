-- Fix "Upload One Document" copy: it invited drag-and-drop onto the task/card modal.

UPDATE tasks
SET description = 'Open Add Record and attach a PDF or image so Filla can file it. [onboarding_demo]'
WHERE title = 'Upload One Document'
  AND description LIKE '%[onboarding_demo]%'
  AND description ILIKE '%drag and drop%';
