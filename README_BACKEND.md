# Filla Backend Overview

This backend layer provides:
- Domain services (tasks, messages, compliance, properties)
- AI integration (extractor + critic)
- Shared types
- Utilities for consistent async/error behaviour

Use hooks for UI integration:
- /hooks/useTasks.ts
- /hooks/useCompliance.ts
- /hooks/useProperties.ts

