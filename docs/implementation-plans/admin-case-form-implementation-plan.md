# Admin Add/Edit Case Form - Implementation Plan

## Executive Summary

This document outlines the phased implementation plan for the Admin Add/Edit Case form, a complex multi-section form with autocomplete, file uploads, quick-add modals, and relationship management. The implementation leverages existing architectural patterns in the codebase to ensure consistency and maintainability.

---

## Current System Architecture Analysis

### Technology Stack
- **Frontend Framework**: Next.js 15 with App Router
- **Form Management**: React Hook Form v7.71.0 + Zod v4.3.5
- **State Management**:
  - Zustand (global UI state)
  - TanStack Query v5 (server state/caching)
  - React Hook Form (form state)
- **API Client**: Axios with interceptors
- **UI Components**: shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS

### Existing Patterns to Follow
1. **Form Pattern**: AiProviderFormDialog - Complex form with create/edit modes, dynamic validation
2. **Multi-Section Form**: NotePublishPage - Two-column layout with conditional sections
3. **Autocomplete/Search**: Professional Info Form - Debounced server-side search with multi-select
4. **File Upload**: FeedbackDialog - Drag-and-drop with preview and validation
5. **Quick-Add Modals**: AiProviderFormDialog - Controlled modal with form submission
6. **API Integration**: adminAiApi - Service layer with TanStack Query hooks

---

## Phase 1: Foundation & Data Layer

### Objective
Establish the data foundation, API integration, and type safety for the entire feature.

### Architecture Components

#### 1.1 Type Definitions (`/types/admin-cases.ts`)
**Purpose**: Centralized TypeScript interfaces for type safety across the feature.

**Key Types to Define**:
- `CaseFormData` - Form data structure (maps to API payload)
- `CaseDetailResource` - Full case response from GET endpoint
- `CaseSummaryResource` - Lightweight case for lists/relationships
- `CountryResource`, `CourtResource`, `CourseResource`, `JudgeResource`
- `QuickAddFormData` - For inline creation modals
- `CaseFileResource` - File metadata structure

**Design Decisions**:
- Use strict typing with no optional fields where API requires them
- Separate form data types from API response types (transformation layer)
- Include metadata fields for UI state (e.g., `_isNew` flag for tracking changes)

#### 1.2 API Service Layer (`/lib/api/admin-cases.ts`)
**Purpose**: Centralized API methods for all case-related operations.

**Architecture**:
```
adminCasesApi
├── Cases
│   ├── getCases(params) -> List with pagination
│   ├── getCaseBySlug(slug) -> Full detail
│   ├── createCase(data) -> Create with relationships
│   ├── updateCase(id, data) -> Partial update
│   └── deleteCase(id) -> Soft delete
├── Lookup Tables
│   ├── getCountries(params) -> Paginated list
│   ├── createCountry(data) -> Quick-add
│   ├── getCourts(params) -> Paginated list with country filter
│   ├── createCourt(data) -> Quick-add
│   ├── getCourses(params) -> Paginated list
│   ├── createCourse(data) -> Quick-add
│   ├── getJudges(params) -> Paginated list
│   └── createJudge(data) -> Quick-add
├── Autocomplete
│   ├── searchCaseTopics(search) -> String array
│   └── searchCaseTags(search) -> String array
└── Files
    ├── uploadCaseFile(caseId, file) -> File resource
    ├── getCaseFiles(caseId) -> File list
    └── deleteFile(fileId) -> Delete confirmation
```

**Design Decisions**:
- Use Axios DTO pattern with automatic token injection
- Return typed promises with proper error handling
- Support pagination, filtering, and sorting via query params
- Implement request/response transformations where API shape differs from UI needs

#### 1.3 TanStack Query Hooks (`/lib/hooks/useAdminCases.ts`)
**Purpose**: React hooks for data fetching, caching, and mutations.

**Architecture**:
```
Query Key Factory Pattern
adminCasesKeys
├── all: ['admin', 'cases']
├── lists: () => [...all, 'list']
├── listWithParams: (params) => [...lists(), params]
├── detail: (slug) => [...all, 'detail', slug]
├── countries: () => [...all, 'countries']
├── countriesList: (search) => [...countries(), 'list', search]
├── courts: () => [...all, 'courts']
├── courtsList: (search) => [...courts(), 'list', search]
├── topics: (search) => [...all, 'topics', search]
└── tags: (search) => [...all, 'tags', search]
```

**Hooks to Create**:
- `useCase(slug)` - Fetch single case (with includes via query params)
- `useCases(params)` - Fetch case list with filters
- `useCountries(search)` - Fetch countries with search
- `useCourts(search, countryId?)` - Fetch courts with optional country filter
- `useCourses(search)` - Fetch courses with search
- `useJudges(search)` - Fetch judges with search
- `useCaseTopics(search)` - Fetch topic suggestions
- `useCaseTags(search)` - Fetch tag suggestions
- `useCreateCase()` - Mutation for creating case
- `useUpdateCase()` - Mutation for updating case
- `useUploadCaseFile()` - Mutation for file upload
- `useDeleteCaseFile()` - Mutation for file deletion
- Quick-add mutations: `useCreateCountry()`, `useCreateCourt()`, etc.

**Design Decisions**:
- Implement aggressive caching (5 minute stale time for lookup tables)
- Auto-invalidate related queries on mutations
- Optimistic updates for better UX where applicable
- Expose loading/error states for UI feedback

#### 1.4 Validation Schemas (`/lib/validations/admin-cases.ts`)
**Purpose**: Zod schemas for form validation with reusable patterns.

**Schemas to Define**:
- `caseFormSchema` - Main case form (conditional validation for create vs edit)
- `countryFormSchema` - Quick-add country validation
- `courtFormSchema` - Quick-add court validation
- `courseFormSchema` - Quick-add course validation
- `judgeFormSchema` - Quick-add judge validation

**Validation Rules**:
- Required fields: title (max 500), body (required text)
- Optional with constraints: citation (max 500), level (enum), topic (max 255)
- Arrays: tags (array of strings, each max 100), judge_ids, similar_case_ids, cited_case_ids
- Relationships: validate IDs exist (client-side pre-validation)
- Self-reference prevention: similar/cited cases cannot include current case ID
- File validation: type checking, size limits (20MB), count limits (10 files)

**Design Decisions**:
- Use `.refine()` for complex cross-field validation
- Dynamic schema based on create vs edit mode (similar to AiProviderFormDialog pattern)
- Reusable validation utilities (e.g., `slugValidation`, `arrayOfIdsValidation`)

### Deliverables
- [ ] Type definitions file created
- [ ] API service layer implemented with all endpoints
- [ ] TanStack Query hooks created with proper key factory
- [ ] Validation schemas defined with comprehensive rules
- [ ] Unit tests for validation schemas
- [ ] API integration tests with mock server

### Dependencies
- None (Foundation phase)

### Estimated Complexity
**Medium** - Requires careful API mapping and type definition, but follows existing patterns.

---

## Phase 2: Core Form Structure & Basic Inputs

### Objective
Build the main form component shell with basic input sections, implementing create/edit mode toggling.

### Architecture Components

#### 2.1 Main Form Component (`/components/admin/cases/CaseFormPage.tsx`)
**Purpose**: Top-level page component managing form lifecycle and mode detection.

**Architecture**:
```
Component Hierarchy
CaseFormPage
├── Mode Detection (useParams to check for edit slug)
├── Data Fetching (useCase if edit mode)
├── Form Initialization (React Hook Form with dynamic defaults)
├── Layout Structure (Two-column responsive grid)
├── Section 1: BasicInformationSection
├── Section 2: LegalInformationSection
├── Section 3: CourtInformationSection
├── Section 4: RelationshipsSection (Similar/Cited Cases)
├── Section 5: CaseReportSection (Rich text)
├── Section 6: FileUploadSection
└── Action Buttons (Cancel/Submit)
```

**State Management Design**:
```
Form State (React Hook Form)
├── Local form state for all inputs
├── Form validation via Zod schema
├── isDirty tracking for "No changes" detection
└── Field-level error display

UI State (Local useState)
├── isSubmitting - Mutation loading state
├── showDuplicateWarning - Title similarity results
├── expandedSections - Collapsible section toggles
└── Modal states for quick-add dialogs

Server State (TanStack Query)
├── Lookup table data (countries, courts, courses, judges)
├── Autocomplete results (topics, tags, cases)
└── Current case data (edit mode only)
```

**Design Decisions**:
- Single-page form (not multi-step) with logical sections
- Responsive two-column layout: full-width on mobile, 2-col on desktop
- Section dividers with clear labels for visual organization
- Sticky action buttons at bottom for accessibility
- Auto-save NOT implemented (explicit save required for data integrity)

#### 2.2 Basic Information Section
**Components**:
- Title Input with duplicate detection
- Legal Principles Textarea
- Case Summary Textarea (required)

**Title Duplicate Detection Architecture**:
```
User Input (Title Field)
  ↓ (debounce 300ms)
Search API (GET /api/cases?search=title)
  ↓ (filter: results matching title)
UI Response
  ├── No matches: Normal input styling
  └── Matches found:
      ├── Yellow warning border
      ├── Dropdown with suggestions
      ├── Click suggestion → Navigate to edit page
      └── Footer: "Don't see your case? Continue typing"
```

**Implementation Pattern**:
- Follow Professional Info Form's debounced search pattern
- Custom hook: `useCaseTitleSearch(title)` with 300ms debounce
- Results displayed in Popover positioned below input
- Keyboard navigation: Arrow keys to navigate, Enter to select, Escape to close

#### 2.3 Legal Information Section
**Components**:
- Course Dropdown (with quick-add button)
- Legal Topic Autocomplete (searchable, create new)
- Case Tags Multi-Select (searchable, create new, badge display)
- Academic Level Dropdown (Nigeria format: ['100 Level', '200 Level', '300 Level', '400 Level', '500 Level', '600 Level', 'Law School'])
- Judicial Precedent Input (text field for now)

**Course Dropdown with Quick-Add**:
```
UI Layout
Select Trigger (Combobox)
  ├── Search input (debounced)
  ├── Options list from API
  └── Footer: "+ Add New Course" button
      ↓ (onClick)
QuickAddCourseDialog (Modal)
  ├── Simple form: name input
  ├── Submit → API call
  ├── Success:
  │   ├── Close modal
  │   ├── Show success toast
  │   ├── Invalidate courses query
  │   └── Auto-select new course in dropdown
  └── Error: Show validation errors
```

**Design Decisions**:
- Use Combobox component from UI library
- Quick-add triggers controlled Dialog component
- Parent component manages quick-add modal state
- After creation, query invalidation auto-refreshes dropdown options

#### 2.4 Court Information Section
**Components**:
- Country Dropdown (with quick-add)
- Court Name Dropdown (with quick-add, filtered by country)
- Case Date Input (date picker)
- Citation Input (text, auto-generated if empty)
- Judges Multi-Select (tag input with autocomplete)

**Court Filtering Architecture**:
```
State Flow
User selects Country
  ↓ (update form field)
Form value change detected
  ↓ (trigger)
Court query re-fetches with country filter
  ↓ (API: GET /api/courts?country={countryId})
Court dropdown options updated
  ↓ (clear existing court selection if invalid)
```

**Judges Tag Input Pattern**:
- Text input with autocomplete dropdown
- Enter, comma, or semicolon to add judge
- Prevents duplicates (case-insensitive match)
- Badge display with remove buttons
- Backspace on empty input removes last judge
- Support pasting comma-separated list

### Deliverables
- [ ] CaseFormPage component with layout structure
- [ ] Basic Information section with title duplicate detection
- [ ] Legal Information section with all inputs
- [ ] Court Information section with country-court filtering
- [ ] Form validation integrated with Zod schema
- [ ] Create vs Edit mode detection working
- [ ] Loading states for edit mode data fetching

### Dependencies
- Phase 1 (API layer, types, hooks, validation)

### Estimated Complexity
**High** - Complex form with many interdependent fields and dynamic behavior.

---

## Phase 3: Autocomplete & Multi-Select Components

### Objective
Implement advanced autocomplete and multi-select components for topics, tags, and case relationships.

### Architecture Components

#### 3.1 Topic Autocomplete Component
**Purpose**: Searchable single-select with create-new capability.

**Component Design**:
```
TopicAutocomplete
├── Input Field (search)
├── Debounced API Call (300ms)
├── Dropdown Results
│   ├── Existing topics (from API)
│   └── "Add 'new topic'" option (if no exact match)
├── Selection Handler
│   ├── Existing topic: Set value directly
│   └── New topic: Set value to new string
└── Clear Button
```

**Data Flow**:
```
User types → Debounce → API Call → Results
  ├── Matches found: Display in dropdown
  └── No exact match: Show "Add 'typed value'" option

User selects existing → Update form field with selected value
User selects "Add new" → Update form field with new string value

Backend handles new topic creation on case save
```

**Design Decisions**:
- Single-select (only one topic per case)
- Free-form text allowed (not restricted to existing topics)
- No client-side topic creation API call (backend creates on case save)
- Use existing Combobox UI component pattern

#### 3.2 Tags Multi-Select Component
**Purpose**: Searchable multi-select with badge display and create-new capability.

**Component Design**:
```
TagsMultiSelect
├── Badge Display Area (selected tags)
│   └── Each badge: Tag name + Remove button
├── Input Field (search + add)
├── Debounced API Call (300ms)
├── Dropdown Results
│   ├── Existing tags (filtered by search, excluding selected)
│   └── "Add 'new tag'" option (dashed border if new)
├── Keyboard Shortcuts
│   ├── Enter: Add current input or selected item
│   ├── Comma/Semicolon: Split and add multiple tags
│   ├── Backspace (empty input): Remove last tag
│   └── Escape: Close dropdown
└── Paste Handler (comma-separated list → multiple badges)
```

**State Management**:
```
Local State
├── selectedTags: string[] (form field value)
├── searchQuery: string (input value)
├── dropdownOpen: boolean

API State (TanStack Query)
└── availableTags: string[] (from API, filtered)
```

**Tag Addition Logic**:
```
User Input → Validation
  ├── Check if tag already selected (prevent duplicates)
  ├── Check if tag exists in API results (use existing)
  └── If new: Allow creation (add to selected array)

Form Submit
  ├── All tags (existing + new) sent as string array
  └── Backend handles new tag creation and association
```

**Design Decisions**:
- Case-insensitive duplicate checking
- No maximum tag limit (API may enforce)
- Smart paste handling: split by comma/semicolon
- Tags stored as uppercase (normalize on input)

#### 3.3 Similar Cases Search Component
**Purpose**: Search and select up to 50 related cases.

**Component Architecture**:
```
SimilarCasesSelector
├── Header: "Similar Cases (N/50)"
├── Helper Text: "Search and select cases..."
├── Search Input (debounced)
├── Results List
│   ├── Case Card
│   │   ├── Title
│   │   ├── Court (with icon)
│   │   ├── Date (with icon)
│   │   ├── Citation
│   │   └── "+" Add button
│   └── Empty State: "No cases found matching 'query'"
├── Selected Cases Display
│   ├── Badge with checkmark icon
│   ├── Case title
│   └── Remove "X" button
└── Footer: "N more cases can be added"
```

**Search Filtering Logic**:
```
API Query: GET /api/cases?search={query}
  ↓
Client-Side Filtering
  ├── Exclude current case (in edit mode)
  ├── Exclude already selected cases
  └── Display remaining results
```

**Design Decisions**:
- Use CaseSummaryResource type for results (lightweight)
- Display limit: 10 results max in dropdown (pagination if needed)
- Selected cases stored as array of IDs: `similar_case_ids: number[]`
- Visual distinction from Cited Cases (different color scheme)

#### 3.4 Cited Cases Search Component
**Purpose**: Search and select up to 50 formally cited cases.

**Component Design**:
- Clone of Similar Cases component with visual differences:
  - Quote icon instead of checkmark in selected badges
  - Different color scheme (primary-tinted borders)
  - Different helper text: "Cases that this case formally cites..."
  - Different toast message: "Added as cited case"

**State Management**:
```
Similar Cases State
├── selectedSimilarCases: number[]
└── similarCasesSearch: string

Cited Cases State
├── selectedCitedCases: number[]
└── citedCasesSearch: string

Shared Case Search Results (TanStack Query)
└── useCases(searchQuery) - Reused for both components
```

**Design Decisions**:
- Separate state management for similar vs cited
- Share search API query (cost optimization)
- Independent 50-case limits for each relationship type
- Self-reference validation on submit (prevent adding own case ID)

### Deliverables
- [ ] TopicAutocomplete component implemented
- [ ] TagsMultiSelect component with all features
- [ ] SimilarCasesSelector component
- [ ] CitedCasesSelector component
- [ ] Keyboard navigation working for all components
- [ ] Paste handling for tags implemented
- [ ] Integration with main form complete

### Dependencies
- Phase 1 (API hooks for autocomplete)
- Phase 2 (Main form structure)

### Estimated Complexity
**High** - Complex interactions, state management, and UX polish required.

---

## Phase 4: Quick-Add Modals

### Objective
Implement inline creation dialogs for Countries, Courts, and Courses.

### Architecture Components

#### 4.1 Quick-Add Modal Pattern
**Generic Pattern for All Quick-Add Modals**:

**Component Structure**:
```
QuickAddEntityDialog
├── Props
│   ├── open: boolean
│   ├── onOpenChange: (open: boolean) => void
│   └── onSuccess: (newEntity: Entity) => void
├── Dialog Component (shadcn Dialog)
│   ├── Header: "Add New {Entity}"
│   ├── Form (React Hook Form)
│   │   ├── Minimal required fields only
│   │   └── Validation via Zod schema
│   ├── Footer Actions
│   │   ├── Cancel button
│   │   └── Submit button (with loading spinner)
└── Mutation Handler
    ├── useCreateEntity() hook
    ├── onSuccess: Close modal + callback
    └── onError: Display validation errors
```

**Integration with Parent Form**:
```
Parent Component State
├── showQuickAddModal: boolean (controls modal open/close)
└── quickAddType: 'country' | 'court' | 'course' | null

User clicks "+ Add New Country"
  ↓
Parent sets: showQuickAddModal = true, quickAddType = 'country'
  ↓
QuickAddCountryDialog renders with open={true}
  ↓
User submits form
  ↓
Mutation success
  ├── Query invalidation (refetch countries list)
  ├── Close modal: onOpenChange(false)
  ├── Success toast: "Country created successfully"
  └── Parent auto-selects new country (via onSuccess callback)
```

#### 4.2 QuickAddCountryDialog
**Fields**:
- Name (required, max 255)
- Code (required, max 3, unique)
- Abbreviation (optional, max 10)

**Validation**:
- Name: Required, no duplicates (server-side check)
- Code: Required, uppercase, 2-3 characters

**Auto-Selection Logic**:
```
onSuccess callback receives newCountry
  ↓
Parent form updates field:
  form.setValue('country_id', newCountry.id)
  ↓
Court dropdown clears (dependency reset)
```

#### 4.3 QuickAddCourtDialog
**Fields**:
- Name (required, max 255, unique)
- Country (required, dropdown pre-filled if parent has country selected)
- Abbreviation (optional, auto-generated from name initials)

**Pre-fill Logic**:
```
Parent form has country_id selected
  ↓
Pass as prop: defaultCountryId={form.watch('country_id')}
  ↓
QuickAddCourtDialog pre-selects country in dropdown
  ↓
User can change country if needed
```

**Auto-Generation**:
- Abbreviation: Extract initials from name (e.g., "Supreme Court" → "SC")
- User can override auto-generated value

#### 4.4 QuickAddCourseDialog
**Fields**:
- Name (required, max 255, unique)

**Simplest Modal**:
- Single field form
- Slug auto-generated on backend
- Immediate feedback on duplicate names

### Deliverables
- [ ] QuickAddCountryDialog component
- [ ] QuickAddCourtDialog component
- [ ] QuickAddCourseDialog component
- [ ] Integration with parent form dropdowns
- [ ] Auto-selection after creation working
- [ ] Error handling for duplicate entries
- [ ] Success toast notifications

### Dependencies
- Phase 1 (Create mutations)
- Phase 2 (Parent form structure)

### Estimated Complexity
**Medium** - Straightforward forms, but requires careful state coordination with parent.

---

## Phase 5: Rich Text Editor & File Upload

### Objective
Implement the Case Report rich text section and file upload functionality.

### Architecture Components

#### 5.1 Case Report Text Editor
**Component**: Reuse or adapt existing rich text editor pattern.

**Editor Requirements**:
- Basic formatting: Bold, italic, underline
- Lists: Bullet and numbered
- Links: Insert and edit hyperlinks
- Headings: H2, H3 levels
- Paste cleanup: Strip unsafe HTML, preserve basic formatting

**Integration Pattern**:
```
Form Field: full_report (string, optional)

Editor Component
├── Toolbar (formatting buttons)
├── Editable Content Area
└── Character count indicator (optional)

State Binding
  ├── form.setValue('full_report', htmlContent)
  └── form.watch('full_report') for initial value
```

**Design Decisions**:
- Store as HTML string in database (API accepts `full_report` as string)
- Optional field (can be empty)
- Collapsible section on view mode (mentioned in old UX)
- No autosave (explicit submit only)

**Library Options**:
- Option A: TipTap (if already in dependencies)
- Option B: Lexical (modern, flexible)
- Option C: Simple contentEditable with custom toolbar

#### 5.2 File Upload Section
**Component**: Adapt existing FileUpload component from FeedbackDialog pattern.

**Architecture**:
```
FileUploadSection
├── Upload Area (drag-and-drop zone)
│   ├── Dashed border (gray default, primary on dragover)
│   ├── Icon + Text: "Choose files or drag and drop"
│   ├── Supported formats text
│   └── Size limit text: "Max 20MB per file, up to 10 files"
├── File List Display
│   ├── New Files (pending upload)
│   │   └── FilePreviewCard
│   │       ├── File type icon (dynamic based on mime type)
│   │       ├── File name
│   │       ├── File size (formatted: "2.45 MB")
│   │       └── Remove button
│   └── Existing Files (edit mode only)
│       └── ExistingFileCard
│           ├── File type icon
│           ├── File name
│           ├── Download button
│           └── Delete button (confirmation required)
└── Counter: "Selected Files (N/10)"
```

**File Upload Flow**:

**Create Mode**:
```
User selects files
  ↓
Store in local state: newFiles: File[]
  ↓
User submits form
  ↓
Case created (POST /api/cases)
  ↓
For each file in newFiles:
  POST /api/cases/{newCaseId}/files with FormData
  ↓
Navigate to case detail page
```

**Edit Mode**:
```
Component mounts
  ↓
Fetch existing files: GET /api/cases/{caseId}/files
  ↓
Display existing files separately from new uploads
  ↓
User can:
  ├── Add new files (store in newFiles array)
  └── Delete existing files (immediate API call with confirmation)
      ↓
      DELETE /api/files/{fileId}
      ↓
      Success: Remove from UI + show toast
      ↓
      Query invalidation: Refetch files list
```

**Validation**:
```
On file selection:
  ├── Check file type (PDF, DOC, DOCX, TXT, RTF, JPG, PNG, GIF, WEBP)
  ├── Check file size (max 20MB)
  └── Check total count (max 10 files)
      ↓
      Invalid file: Show error toast + don't add to list
      Valid file: Add to newFiles array
```

**Design Decisions**:
- New files NOT uploaded until case is saved (batched upload)
- Existing files deletable immediately (no "unsaved changes" for deletions)
- File preview: Type icon (no image thumbnails to simplify)
- Download existing files via signed URL from API
- Progress indicators during batch upload (Phase 7 enhancement)

#### 5.3 File Type Icons
**Icon Mapping**:
```
MIME Type → Icon Component
├── application/pdf → FileText (blue)
├── application/msword → FileText (green)
├── application/vnd.openxmlformats... → FileText (green)
├── text/plain → FileText (gray)
├── text/rtf → FileText (gray)
├── image/jpeg → Image (purple)
├── image/png → Image (purple)
├── image/gif → Image (purple)
└── image/webp → Image (purple)
```

### Deliverables
- [ ] Rich text editor integrated for full_report field
- [ ] File upload drag-and-drop zone
- [ ] File validation implemented
- [ ] New files display with remove functionality
- [ ] Existing files display with download/delete
- [ ] File upload on case creation/update
- [ ] File type icons rendering correctly

### Dependencies
- Phase 2 (Main form structure)

### Estimated Complexity
**Medium** - File upload has some complexity, but existing patterns provide guidance.

---

## Phase 6: Form Submission & Error Handling

### Objective
Implement robust form submission logic, error handling, and user feedback.

### Architecture Components

#### 6.1 Submit Handler Architecture
**Flow Diagram**:
```
User clicks Submit Button
  ↓
Form Validation (Zod schema)
  ├── Invalid: Stop submission + show field errors
  └── Valid: Continue
      ↓
Check Edit Mode Changes
  ├── No changes (isDirty === false):
  │   ├── Show toast: "No changes to save"
  │   └── Navigate back
  └── Has changes: Continue
      ↓
Prepare Payload
  ├── Extract form values
  ├── Transform data (e.g., tags array, judge_ids array)
  ├── Remove unchanged fields (edit mode optimization)
  └── Validate relationships (no self-references)
      ↓
Mutation Execution
  ├── Create: useCreateCase.mutate(payload)
  └── Update: useUpdateCase.mutate({ id, data: payload })
      ↓
Mutation Response
  ├── Success:
  │   ├── Upload new files (if any)
  │   ├── Show success toast
  │   ├── Navigate to case detail page
  │   └── Invalidate case queries
  └── Error: Handle errors (see 6.2)
```

**Payload Transformation Logic**:
```
Form Values → API Payload Mapping
├── Direct fields: title, body, principles, level, etc.
├── Relationship IDs:
│   ├── course_id: number | undefined
│   ├── country_id: number | undefined
│   ├── court_id: number | undefined
│   ├── judge_ids: number[] (from multi-select)
│   ├── similar_case_ids: number[] (from selector)
│   └── cited_case_ids: number[] (from selector)
├── Arrays:
│   ├── tags: string[] (from multi-select badges)
│   └── topic: string (single value from autocomplete)
└── Dates:
    └── judgment_date: YYYY-MM-DD string (from date picker)
```

**Edit Mode Change Tracking**:
```
React Hook Form isDirty flag
  ├── Tracks all field changes
  └── Returns false if no modifications

Before submit:
  if (!form.formState.isDirty && mode === 'edit') {
    toast.info('No changes to save')
    navigate back
    return
  }
```

#### 6.2 Error Handling Architecture
**Error Types & Responses**:

**1. Validation Errors (422)**:
```
API Response:
{
  "success": false,
  "message": "Please provide a case title. (and 1 more error)",
  "errors": {
    "title": ["Please provide a case title."],
    "body": ["Please provide the case body."]
  }
}

Handler Logic:
extractApiError(error)
  ↓
Iterate over errors object:
  ├── For each field with error:
  │   form.setError(field, { message: errorMessage })
  └── Display field errors under respective inputs
  ↓
Toast: Show general error message
```

**2. Relationship Errors**:
```
API Response (self-reference):
{
  "success": false,
  "message": "A case cannot be similar to itself.",
  "errors": {
    "similar_case_ids.0": ["A case cannot be similar to itself."]
  }
}

Handler Logic:
  ├── Extract array index from error key
  ├── Highlight problematic case in selector UI
  └── Show toast with specific message
```

**3. File Upload Errors**:
```
File too large (>20MB):
  ├── Show toast: "File '{name}' exceeds 20MB limit"
  └── Don't add to file list

Invalid file type:
  ├── Show toast: "File '{name}' is not a supported format"
  └── Don't add to file list

Max files exceeded:
  ├── Prevent selection
  └── Show toast: "Maximum of 10 files allowed"
```

**4. Network Errors**:
```
Axios interceptor catches network failures
  ↓
Display toast: "Network error. Please check your connection."
  ↓
Keep form data intact (allow retry)
```

#### 6.3 Loading States & Disabled Controls
**UI State During Submission**:
```
isSubmitting = true (from mutation isPending)
  ↓
Apply to UI:
  ├── Submit button: Disabled + spinner icon + text "Creating..." / "Saving..."
  ├── Cancel button: Disabled
  ├── All form inputs: Disabled (prevent mid-submit changes)
  ├── Quick-add buttons: Disabled
  └── File upload: Disabled
```

**Implementation**:
```jsx
<Button disabled={isSubmitting || !form.formState.isValid}>
  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {isSubmitting ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Case')}
</Button>

<FormField disabled={isSubmitting} ... />
```

#### 6.4 Success Feedback & Navigation
**Success Flow**:
```
Mutation Success
  ↓
Show Toast
  ├── Create: "Case created successfully"
  └── Update: "Case updated successfully"
  ↓
Query Invalidation
  ├── invalidateQueries(adminCasesKeys.lists())
  └── invalidateQueries(adminCasesKeys.detail(slug))
  ↓
Navigate to Case Detail
  ├── Get new case slug from response
  └── router.push(`/admin/cases/${slug}`)
```

### Deliverables
- [ ] Submit handler with payload transformation
- [ ] isDirty check for "No changes" detection
- [ ] Field-level error display from API responses
- [ ] File upload error handling
- [ ] Loading states on all interactive elements
- [ ] Success toast and navigation
- [ ] Network error handling

### Dependencies
- Phase 1 (Mutations)
- Phase 2-5 (All form sections)

### Estimated Complexity
**Medium** - Error handling requires thorough testing, but patterns are well-established.

---

## Phase 7: Polish & Edge Cases

### Objective
Handle edge cases, improve UX, and add final polish.

### Features

#### 7.1 Keyboard Navigation
**Enhancements**:
- Tab order optimized for logical flow
- Enter key submits form (when not in textarea)
- Escape key closes dropdowns and modals
- Arrow key navigation in all autocomplete dropdowns
- Ctrl+S to save (prevent browser save dialog)

#### 7.2 Empty States & Placeholders
**Components**:
- Empty search results: "No cases found matching '{query}'"
- No files uploaded: Helpful text in upload zone
- No topics/tags selected: Placeholder text guiding user

#### 7.3 Accessibility
**ARIA Attributes**:
- Proper labels for all inputs
- Error announcements for screen readers
- Focus management in modals
- Keyboard-only operation support

#### 7.4 Responsive Design
**Breakpoints**:
- Mobile: Single column layout, stacked sections
- Tablet: Hybrid layout, some sections 2-col
- Desktop: Full 2-column layout with sticky sidebar (optional)

#### 7.5 Performance Optimizations
**Lazy Loading**:
- Code-split rich text editor (load on demand)
- Defer non-critical autocomplete queries

**Debouncing**:
- All search inputs: 300ms debounce
- Title duplicate check: 500ms debounce (longer to avoid noise)

**Memoization**:
- Expensive computed values (e.g., filtered case lists)
- Callback functions passed to child components

#### 7.6 Browser Compatibility
**Testing**:
- File drag-and-drop fallback for older browsers
- Date picker polyfill if needed
- Test on Safari, Chrome, Firefox, Edge

### Deliverables
- [ ] Keyboard shortcuts implemented
- [ ] Empty states designed and implemented
- [ ] ARIA attributes added
- [ ] Responsive design tested on all breakpoints
- [ ] Performance optimizations applied
- [ ] Cross-browser testing complete

### Dependencies
- All previous phases

### Estimated Complexity
**Medium** - Incremental improvements, but testing is time-consuming.

---

## Phase 8: Testing & Documentation

### Objective
Ensure code quality, reliability, and maintainability through comprehensive testing and documentation.

### Testing Strategy

#### 8.1 Unit Tests
**Components to Test**:
- Validation schemas (Zod)
  - Valid payloads pass
  - Invalid payloads fail with correct messages
  - Edge cases (max lengths, array limits)

- Utility functions
  - Payload transformation logic
  - Date formatting
  - File size formatting

- Custom hooks (logic only)
  - Debounce behavior
  - Query key generation

**Tools**: Vitest + Testing Library

#### 8.2 Integration Tests
**Scenarios**:
- Create new case (happy path)
- Edit existing case (happy path)
- Form validation errors displayed
- Quick-add modal creates entity and selects it
- File upload with validation
- Autocomplete search and selection

**Tools**: Testing Library + MSW (Mock Service Worker for API mocking)

#### 8.3 E2E Tests (Optional)
**Critical Flows**:
- Complete case creation workflow
- Edit case and save changes
- Quick-add country, select it, add court
- Upload files, delete files

**Tools**: Playwright or Cypress

#### 8.4 Manual Testing Checklist
- [ ] Create case with all fields populated
- [ ] Create case with minimal required fields
- [ ] Edit case and change each section
- [ ] Test all quick-add modals
- [ ] Test file upload (valid and invalid files)
- [ ] Test duplicate title detection
- [ ] Test autocomplete for topics, tags, cases
- [ ] Test self-reference validation (similar/cited cases)
- [ ] Test error handling (network errors, validation errors)
- [ ] Test on mobile, tablet, desktop
- [ ] Test keyboard navigation
- [ ] Test with screen reader

### Documentation

#### 8.5 Code Documentation
**Inline Comments**:
- Complex logic explained
- Rationale for non-obvious decisions
- TODO markers for future enhancements

**JSDoc**:
- All exported functions
- Custom hooks
- Component props interfaces

#### 8.6 User Documentation
**Admin Guide** (`/docs/admin-guides/case-management.md`):
- How to create a case
- How to edit a case
- Understanding case relationships (similar vs cited)
- File upload guidelines
- Tips for using autocomplete features

#### 8.7 Developer Documentation
**Technical Guide** (`/docs/implementation-plans/case-form-technical-guide.md`):
- Architecture overview
- Data flow diagrams
- API integration details
- State management patterns
- How to extend functionality

### Deliverables
- [ ] Unit tests for validation schemas
- [ ] Unit tests for utilities
- [ ] Integration tests for form workflows
- [ ] Manual testing checklist completed
- [ ] Admin user guide written
- [ ] Developer technical guide written
- [ ] Code documentation complete

### Dependencies
- All previous phases

### Estimated Complexity
**High** - Comprehensive testing is essential but time-intensive.

---

## Implementation Timeline

### Overview
Total estimated duration: **6-8 weeks** (with 1 developer, full-time)

### Phase Breakdown

| Phase | Duration | Parallel Work Possible |
|-------|----------|------------------------|
| Phase 1: Foundation & Data Layer | 1 week | No (foundation) |
| Phase 2: Core Form Structure | 1.5 weeks | Partial (sections can be built in parallel by multiple devs) |
| Phase 3: Autocomplete & Multi-Select | 1.5 weeks | Yes (each component independent) |
| Phase 4: Quick-Add Modals | 1 week | Yes (each modal independent) |
| Phase 5: Rich Text & File Upload | 1 week | Yes (can be parallel) |
| Phase 6: Form Submission & Errors | 1 week | No (depends on all form sections) |
| Phase 7: Polish & Edge Cases | 1 week | Partial (individual features can be parallelized) |
| Phase 8: Testing & Documentation | 1.5 weeks | Partial (unit tests can be written during development) |

### Parallelization Strategy
With **2 developers**:
- Developer A: Phases 1, 2, 6
- Developer B: Phases 3, 4, 5 (starts after Phase 1 completion)
- Both: Phases 7, 8
- **Total duration: 4-5 weeks**

With **3 developers**:
- Dev A: Phase 1, then Phase 2 (sections 1-3)
- Dev B: Phase 3 (all autocomplete components)
- Dev C: Phase 4 + 5 (modals + file upload)
- All: Integration, Phase 6, 7, 8
- **Total duration: 3-4 weeks**

---

## Risk Assessment

### Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| API endpoint changes or inconsistencies | Medium | Early integration testing with backend team, API contract validation |
| Rich text editor library compatibility | Low | Evaluate multiple options, use stable library with good TypeScript support |
| File upload size/performance issues | Medium | Implement progress indicators, chunk uploads if needed, validate early |
| Complex state synchronization (quick-add) | Medium | Use TanStack Query cache invalidation, thorough testing |
| Browser compatibility (drag-and-drop) | Low | Feature detection, graceful fallbacks |

### UX Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Form overwhelming for users | Medium | Clear section organization, progressive disclosure, helpful tooltips |
| Autocomplete performance lag | Medium | Aggressive debouncing, loading indicators, optimistic UI |
| Mobile usability issues | Medium | Early responsive testing, touch-friendly targets |
| Unclear error messages | Low | Use API error messages, add contextual help text |

### Project Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Scope creep (feature additions) | High | Strict adherence to defined UX spec, document future enhancements separately |
| Backend API delays | Medium | Mock API responses for frontend development, parallel development |
| Resource availability | Medium | Clear phase dependencies, enable parallel work where possible |

---

## Success Criteria

### Functional Requirements
- [ ] Admins can create cases with all fields
- [ ] Admins can edit existing cases
- [ ] All quick-add modals functional
- [ ] File upload/download/delete working
- [ ] Autocomplete search responsive and accurate
- [ ] Relationship management (similar/cited cases) working
- [ ] Form validation comprehensive and user-friendly

### Non-Functional Requirements
- [ ] Form submission < 2 seconds (excluding file uploads)
- [ ] Autocomplete search results < 500ms
- [ ] Mobile-responsive on all screen sizes
- [ ] Accessible (WCAG 2.1 AA compliant)
- [ ] Zero console errors or warnings
- [ ] 80%+ code coverage for business logic

### User Experience
- [ ] No user reports confusion about form flow
- [ ] Quick-add modals feel seamless (no jarring transitions)
- [ ] Error messages clear and actionable
- [ ] Loading states prevent "is it working?" uncertainty

---

## Future Enhancements (Out of Scope)

These features are NOT included in the current implementation plan but may be considered for future iterations:

1. **Content Request Integration**: Link case creation to user content requests
2. **Auto-Save**: Periodic form state persistence (draft mode)
3. **Version History**: Track case edit history with diffs
4. **Bulk Import**: CSV/Excel import for multiple cases
5. **AI-Powered Suggestions**: Auto-suggest topics, tags, or similar cases based on title/body
6. **Advanced Rich Text**: Tables, images, embedded media in case report
7. **Collaborative Editing**: Multiple admins editing simultaneously
8. **Workflow/Approval**: Draft → Review → Publish workflow
9. **Analytics**: Track which fields are most commonly filled, time to complete form
10. **Template System**: Save case templates for common case types

---

## Appendix

### API Endpoint Reference
See: `/docs/apiDocs/case-from-api-reference.md`

### Component Dependency Graph
```
CaseFormPage (Root)
├── BasicInformationSection
│   └── TitleDuplicateChecker
├── LegalInformationSection
│   ├── CourseDropdown → QuickAddCourseDialog
│   ├── TopicAutocomplete
│   ├── TagsMultiSelect
│   └── LevelDropdown
├── CourtInformationSection
│   ├── CountryDropdown → QuickAddCountryDialog
│   ├── CourtDropdown → QuickAddCourtDialog
│   └── JudgesMultiSelect
├── RelationshipsSection
│   ├── SimilarCasesSelector
│   └── CitedCasesSelector
├── CaseReportSection
│   └── RichTextEditor
├── FileUploadSection
│   ├── FileUploadZone
│   ├── NewFilesList
│   └── ExistingFilesList
└── FormActions
```

### Technology Stack Summary
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Form**: React Hook Form + Zod
- **State**: Zustand + TanStack Query
- **UI**: shadcn/ui + Radix UI
- **HTTP**: Axios
- **Styling**: Tailwind CSS
- **Testing**: Vitest + Testing Library + MSW

---

**Document Version**: 1.0
**Last Updated**: 2026-02-11
**Author**: Implementation Team
**Status**: Ready for Review
