# MoCo-API MCP Server - Implementierungsplan

## Überblick

Erstellung eines MCP-Servers, der schreibgeschützten Zugriff auf die MoCo-API für Activities, Projects, User Holidays und User Presences bereitstellt. Der Server ermöglicht zeitraumbezogene Abfragen mit automatischer Summierung und strukturierter Rückgabe der Daten.

## 1. Dokumentation erstellen
- Erstelle `docs/implementation-plans/2025-08-04_moco-api-mcp-server.md` mit diesem vollständigen Plan

## 2. Architektur und Projektstruktur

### 2.1 Neue Dateien erstellen
```
src/
├── index.ts (bereits vorhanden, erweitern)
├── config/
│   └── environment.ts
├── services/
│   └── mocoApi.ts
├── tools/
│   ├── activitiesTools.ts
│   ├── projectsTools.ts
│   ├── userHolidaysTools.ts
│   └── userPresencesTools.ts
├── types/
│   └── mocoTypes.ts
└── utils/
    ├── dateUtils.ts
    ├── timeUtils.ts
    └── errorHandler.ts
```

### 2.2 Konfiguration (src/config/environment.ts)
```typescript
export interface MocoConfig {
  apiKey: string;
  subdomain: string;
  baseUrl: string;
}

export function getMocoConfig(): MocoConfig {
  const apiKey = process.env.MOCO_API_KEY;
  const subdomain = process.env.MOCO_SUBDOMAIN;
  
  if (!apiKey || !subdomain) {
    throw new Error('MOCO_API_KEY und MOCO_SUBDOMAIN Umgebungsvariablen sind erforderlich');
  }
  
  return {
    apiKey,
    subdomain,
    baseUrl: `https://${subdomain}.mocoapp.com/api/v1`
  };
}
```

## 3. API Service Implementation

### 3.1 MoCo API Service (src/services/mocoApi.ts)
- HTTP Client mit automatischem Request/Response Handling
- Authentifizierung über API-Key Header
- Automatische Paginierung für alle Endpoints
- Comprehensive Error Handling für:
  - API Rate Limits (429)
  - Authentifizierungsfehler (401/403) 
  - Netzwerkfehler
  - Ungültige Parameter (400)
  - Server Errors (5xx)
- use context7 für spezifische API Endpoint Details

Key Methoden:
```typescript
class MocoApiService {
  async getActivities(startDate: string, endDate: string): Promise<Activity[]>
  async getProjects(): Promise<Project[]>
  async searchProjects(query: string): Promise<Project[]>
  async getProjectTasks(projectId: number): Promise<Task[]>
  async getUserHolidays(year: number): Promise<UserHoliday[]>
  async getUserPresences(startDate: string, endDate: string): Promise<UserPresence[]>
}
```

### 3.2 Type Definitions (src/types/mocoTypes.ts)
```typescript
export interface Activity {
  id: number;
  date: string; // ISO 8601
  hours: number;
  description: string;
  project_id: number;
  task_id: number;
  user_id: number;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  active: boolean;
  // weitere relevante Felder basierend auf context7
}

export interface Task {
  id: number;
  name: string;
  project_id: number;
  active: boolean;
}

export interface UserHoliday {
  id: number;
  date: string;
  hours: number; // in Tagen als Dezimalzahl (0.5 für halber Tag)
  status: string;
}

export interface UserPresence {
  id: number;
  date: string;
  hours: number; // Dezimalzahl
}

// Aggregierte Datenstrukturen
export interface ActivitySummary {
  date: string;
  projects: ProjectActivitySummary[];
  dailyTotal: {
    hours: number;
    hoursFormatted: string; // "HH:MM"
  };
}

export interface ProjectActivitySummary {
  projectId: number;
  tasks: TaskActivitySummary[];
  projectTotal: {
    hours: number;
    hoursFormatted: string;
  };
}

export interface TaskActivitySummary {
  taskId: number;
  hours: number;
  hoursFormatted: string; // "HH:MM"
}
```

## 4. Utility Functions

### 4.1 Date Utils (src/utils/dateUtils.ts)
```typescript
export function validateDateRange(startDate: string, endDate: string): boolean
export function validateYear(year: number): boolean
export function formatDateISO(date: Date): string
```

### 4.2 Time Utils (src/utils/timeUtils.ts)
```typescript
export function formatHoursToHHMM(hours: number): string
export function sumHours(hours: number[]): number
```

### 4.3 Error Handler (src/utils/errorHandler.ts)
```typescript
export function handleMocoApiError(error: any): string
export function createUserFriendlyErrorMessage(error: any): string
```

## 5. MCP Tools Implementation

### 5.1 Activities Tools (src/tools/activitiesTools.ts)

**Tool: get_activities**
- Parameter: startDate (ISO 8601), endDate (ISO 8601)
- Validierung der Datumsrange
- Abruf aller Activities im Zeitraum via MoCo API
- Gruppierung nach Datum → Projekt → Task
- Berechnung der Summen:
  - Pro Task
  - Pro Projekt pro Tag
  - Pro Tag gesamt
  - Gesamtsumme über gesamten Zeitraum
- Rückgabe in strukturierter Form mit sowohl Dezimalstunden als auch HH:MM Format

Beispiel Rückgabe:
```
Aktivitäten vom 2024-01-01 bis 2024-01-31:

2024-01-15:
  Projekt 123:
    Task 456: 2.5h (2:30)
    Task 789: 1.25h (1:15)
    Projektsumme: 3.75h (3:45)
  Tagessumme: 3.75h (3:45)

2024-01-16:
  Projekt 124:
    Task 790: 4.0h (4:00)
    Projektsumme: 4.0h (4:00)
  Tagessumme: 4.0h (4:00)

Projektsummen (gesamt):
- Projekt 123: 3.75h (3:45)
- Projekt 124: 4.0h (4:00)

Gesamtsumme: 7.75h (7:45)
```

### 5.2 Projects Tools (src/tools/projectsTools.ts)

**Tool: list_projects**
- Abruf aller Projekte
- Rückgabe: ID, Name, Beschreibung, Status

**Tool: search_projects**
- Parameter: query (string)
- Suche in Name und Beschreibung
- Case-insensitive Suche
- Rückgabe: gefundene Projekte mit Highlighting

**Tool: get_project_tasks**
- Parameter: projectId (number)
- Validierung der Projekt-ID
- Abruf aller Tasks des Projekts
- Rückgabe: Task-ID, Name, Status

### 5.3 User Holidays Tools (src/tools/userHolidaysTools.ts)

**Tool: get_user_holidays**
- Parameter: year (number, z.B. 2024)
- Validierung des Jahres
- Abruf aller Urlaubstage des Jahres
- Berechnung:
  - Einzelne Urlaubstage (Datum, Tage)
  - Gesamtsumme genommener Urlaub
  - Jahresanspruch (aus API)
  - Ausschöpfungsgrad in Prozent
  - Resturlaub

Beispiel Rückgabe:
```
Urlaubsübersicht für 2024:

Genommene Urlaubstage:
- 2024-03-15: 1.0 Tag
- 2024-04-22: 0.5 Tag  
- 2024-07-08: 1.0 Tag
- 2024-07-09: 1.0 Tag

Zusammenfassung:
- Genommener Urlaub: 3.5 Tage
- Jahresanspruch: 25 Tage
- Ausschöpfung: 14% (3.5/25)
- Resturlaub: 21.5 Tage
```

### 5.4 User Presences Tools (src/tools/userPresencesTools.ts)

**Tool: get_user_presences**
- Parameter: startDate (ISO 8601), endDate (ISO 8601)
- Validierung der Datumsrange
- Abruf aller Anwesenheiten im Zeitraum
- Aggregation pro Tag (Summe der Anwesenheitszeiten)
- Berechnung der Gesamtsumme
- Rückgabe mit Dezimalstunden und HH:MM Format

Beispiel Rückgabe:
```
Anwesenheiten vom 2024-01-01 bis 2024-01-31:

Tägliche Anwesenheiten:
- 2024-01-15: 8.5h (8:30)
- 2024-01-16: 7.75h (7:45)
- 2024-01-17: 8.0h (8:00)

Gesamtsumme: 24.25h (24:15)
```

## 6. Main Server Integration (src/index.ts)

- Import aller Tool-Module
- Registrierung aller 6 MCP Tools
- Error Handling auf Server-Ebene
- Konfiguration der Server-Capabilities
- use context7 für MCP-spezifische Implementierungsdetails

## 7. Error Handling Strategy

### 7.1 API Error Types
- **Rate Limit (429)**: "API-Limit erreicht. Bitte versuchen Sie es in einigen Sekunden erneut."
- **Authentifizierung (401/403)**: "API-Authentifizierung fehlgeschlagen. Überprüfen Sie MOCO_API_KEY und MOCO_SUBDOMAIN."
- **Bad Request (400)**: "Ungültige Parameter: [Details]"
- **Not Found (404)**: "Ressource nicht gefunden: [Details]"
- **Server Error (5xx)**: "MoCo-Server-Fehler. Bitte später erneut versuchen."
- **Network Error**: "Netzwerkfehler beim Zugriff auf MoCo-API."

### 7.2 Validation Errors
- Ungültige Datumsformate
- Ungültige Datumsbereiche (Ende vor Start)
- Ungültige Jahre (z.B. Zukunft, zu weit in Vergangenheit)
- Fehlende erforderliche Parameter

### 7.3 Empty Result Handling
- "Keine Aktivitäten im Zeitraum [startDate] bis [endDate] gefunden."
- "Keine Projekte gefunden."
- "Keine Tasks für Projekt [projectId] gefunden."
- "Keine Urlaubstage für Jahr [year] gefunden."
- "Keine Anwesenheiten im Zeitraum [startDate] bis [endDate] gefunden."

## 8. Code Quality & Documentation

### 8.1 Dokumentation
- JSDoc für alle Klassen, Methoden und komplexe Funktionen
- Inline-Kommentare für komplexe Logik
- README-Updates mit Nutzungsbeispielen
- API-Mapping Dokumentation

### 8.2 Code Standards
- TypeScript strict mode
- Konsistente Namensgebung (camelCase für Variablen, PascalCase für Types)
- Separation of Concerns (API, Business Logic, Tools)
- Error-first handling
- Immutable data structures wo möglich

## 9. Testing & Verification

### 9.1 Build & Type Checking
```bash
npm run build
```
- TypeScript Kompilierung ohne Fehler
- Alle Imports korrekt aufgelöst
- Type Safety validiert

### 9.2 Manual Testing
- Test mit verschiedenen Datumsbereichen
- Test mit ungültigen Parametern
- Test mit leeren Ergebnissen
- Test der Summenbildung
- Test der Fehlerbehandlung

### 9.3 Integration Testing
- Verbindung zur MoCo-API
- Authentifizierung
- Paginierung
- Error Handling

## 10. Code Review

### 10.1 Architecture Review
- Separation of Concerns validieren
- API Service Design überprüfen
- Error Handling Strategy bewerten
- Type Safety überprüfen

### 10.2 Code Review Points
- Konsistente Error Messages
- Vollständige Input Validation
- Korrekte Zeitberechnung und -formatierung
- Memory Efficiency (keine unnötigen Datenstrukturen)
- Security (keine API-Keys in Logs)

### 10.3 Performance Review
- Effiziente API-Calls
- Minimale Datenübertragung
- Korrekte Paginierung
- No Memory Leaks

## 11. Deployment & Configuration

### 11.1 Environment Setup
```bash
export MOCO_API_KEY="ihr-api-key"
export MOCO_SUBDOMAIN="ihre-subdomain"
```

### 11.2 Usage Examples
```bash
# Development
npm run dev

# Production Build
npm run build
npm start
```

## 12. Final Steps

### 12.1 Documentation
- Erstelle ausführliche README mit Setup-Anweisungen
- Erstelle API-Mapping Dokumentation
- Erstelle Troubleshooting Guide

### 12.2 Repository Management
- Commit mit semantischer Commit Message:
  "feat: implement MoCo-API MCP server with Activities, Projects, User Holidays and Presences tools"
- Erstelle GitHub Pull Request mit ausführlicher Beschreibung
- Tag für Version v1.0.0

### 12.3 Future Enhancements
- Dokumentiere mögliche Erweiterungen (z.B. schreibende Zugriffe)
- Performance Optimierungen
- Caching Strategy für zukünftige Versionen

## Instructions für Implementierung

use context7

When writing code:
- Ensure a proper, concise documentation of packages, classes, functions and methods as well as inline comments where may help a develop understand what is happening.
- comments and documentation in source code files must be written in english
- Reflect on namings of variables, functions, classes or packages are clear enough to understand their purpose. If not, suggest a better name. But only if you are sure your naming is way better than what is currently being used.
- Pay special attention to complex logic, algorithms and data structures:
  - If clauses, switch statements or loops might need additional comments to introduce why branching code is necessary, too.
  - Some functions are also easier to understand than others (e.g. think of Array.reduce() in Typescript/Javascript) - their usage might benefit from a quick explanation what is happening why?
  - Some variable or constant assignments might need a comment to explain why they are required or used in a certain way, or what the expected value over the execution lifecycle is.
  - Some namings might also benefit from being closer to other APIs or libraries used in the same context, so they are easier to understand for a developer familiar with those APIs or libraries. Use context7.
  - Also suggest easier to understand alternatives for complex logic, algorithms or structures if you think they would be easier to understand for a developer new to the codebase.
  - Magic numbers might benefit from constant or variable assignments with a descriptive name, so it is easier to understand what they are used for. But not all magic numbers are worth to be replaced, so use your best judgement here. Also reflect on where to declare such constants or variables, so they are easy to find and understand. E.g. Some might only be used in a single method, so they could be declared there, while others might be used in multiple methods or classes, so they should be declared in a more global scope.

Your base thoughts for all documentation you are planning to write within the code base:
- "How can I introduce a dev to the code following as quickly and simple as possible, so I can make it easy for him to understand the code even when only quickly read across the code?"
- "Thoughtful, clear and precise namings may render some comments unnecessary."
- "Self-explanatory code is better than complex code that requires a lot of comments to understand."