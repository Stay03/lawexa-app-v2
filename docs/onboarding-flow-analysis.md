# Onboarding Flow Analysis - Backend Implementation Guide

## Overview

This document outlines the complete onboarding flow for different user types in Lawexa. Currently, onboarding data is stored in localStorage using Zustand's persist middleware. The backend team will implement an onboarding endpoint to persist this data server-side.

---

## Current localStorage Implementation

### Storage Keys
1. **`lawexa-onboarding`** - Stores temporary onboarding progress
2. **`lawexa-auth`** - Stores auth state including `onboardingComplete` flag

### LocalStorage Structure

```typescript
// lawexa-onboarding store
{
  userType: 'lawyer' | 'law_student' | 'other',
  communicationStyle: 'co_worker' | 'study_guide' | 'assistant',
  locationData: {
    country?: string,
    countryCode?: string,
    region?: string,
    city?: string,
    selectedCountryMatchesDetected?: boolean
  },
  profileData: {
    profession?: string,
    university?: string,
    level?: string,
    lawSchool?: string,
    yearOfCall?: number,
    bio?: string,
    areaOfStudy?: string
  },
  studentEducationLevel: 'university' | 'law_school' | null,
  areasOfExpertise: number[],
  verificationData: {
    callNumber?: string,
    lawyerProfileId?: number,
    uploadedDocuments: LawyerProfileDocument[]
  },
  wantsClientReferrals: boolean | null
}

// lawexa-auth store (partial)
{
  onboardingComplete: boolean
}
```

---

## User Types & Their Flows

### 1. Lawyer (userType: 'lawyer')

**Total Steps:** 6-7 steps (6 if profile skipped, 7 if shown)

#### Flow Diagram
```
Step 1: User Type Selection (lawyer)
   ↓
Step 2: Communication Style
   ↓
Step 3: Location Selection
   ↓
Step 4: Profile Information* (SKIPPED if selected detected country)
   ↓
Step 7: Areas of Expertise Selection
   ↓
Step 8: Verification Documents Upload (optional - can skip)
   ↓
Complete → Update user profile on backend
```

#### Data Collected
```typescript
{
  // Required
  userType: 'lawyer',
  communicationStyle: 'co_worker' | 'study_guide' | 'assistant',
  country: string,
  countryCode: string,
  areasOfExpertise: number[], // Array of expertise IDs

  // Optional (from Step 4 if not skipped)
  region?: string,
  city?: string,

  // Auto-derived
  profession: 'lawyer', // Auto-set for lawyers

  // Optional verification (Step 8)
  callNumber?: string,
  wantsClientReferrals: boolean,
  // Documents are uploaded separately via lawyerVerificationApi
}
```

#### Profile Skip Logic
- **Skipped:** When lawyer selects the auto-detected country (matches user.location.country)
- **Shown:** When lawyer selects a different country

---

### 2. Law Student (userType: 'law_student')

**Total Steps:** 6-7 steps (6 if profile skipped, 7 if shown)

#### Flow Diagram
```
Step 1: User Type Selection (law_student)
   ↓
Step 2: Communication Style
   ↓
Step 3: Location Selection
   ↓
Step 4: Profile Information* (SKIPPED if selected detected country)
   ↓
Step 5: Education Level Selection (university OR law_school)
   ↓
Step 6: Education Details
   └─ If university: University name + Level
   └─ If law_school: Law School name
   ↓
Step 7: Areas of Expertise Selection
   ↓
Complete → Update user profile on backend
```

#### Data Collected
```typescript
{
  // Required
  userType: 'law_student',
  communicationStyle: 'co_worker' | 'study_guide' | 'assistant',
  country: string,
  countryCode: string,
  studentEducationLevel: 'university' | 'law_school',
  areasOfExpertise: number[],

  // Education (conditional on studentEducationLevel)
  university?: string,      // If studentEducationLevel === 'university'
  level?: string,           // If studentEducationLevel === 'university'
  lawSchool?: string,       // If studentEducationLevel === 'law_school'

  // Optional (from Step 4 if not skipped)
  region?: string,
  city?: string,

  // Auto-derived
  profession: 'student',    // Auto-set for law students
  areaOfStudy: 'law',       // Auto-set for law students
}
```

---

### 3. Professional / Other (userType: 'other')

**Total Steps:** 4-6 steps (varies by profession)

#### Flow Diagram
```
Step 1: User Type Selection (other)
   ↓
Step 2: Communication Style
   ↓
Step 3: Location Selection
   ↓
Step 4: Profile Information
   ├─ Name (pre-filled, read-only)
   ├─ Region (optional)
   ├─ City (optional)
   └─ Profession Selection* (required)
   ↓
   ├─ If profession === 'student':
   │   ↓
   │   Step 6: University Selection
   │   ↓
   │   Step 6b: Level + Area of Study
   │   ↓
   │   Complete
   │
   └─ If profession !== 'student':
       ↓
       Complete → Update user profile on backend
```

#### Data Collected

**For Non-Student Professions:**
```typescript
{
  // Required
  userType: 'other',
  communicationStyle: 'co_worker' | 'study_guide' | 'assistant',
  country: string,
  countryCode: string,
  profession: string, // One of: business_owner, researcher, journalist,
                      // legal_consultant, government_official, academic, or custom

  // Optional
  region?: string,
  city?: string,
}
```

**For Student Profession:**
```typescript
{
  // Required
  userType: 'other',
  communicationStyle: 'co_worker' | 'study_guide' | 'assistant',
  country: string,
  countryCode: string,
  profession: 'student',
  university: string,
  level: string,
  areaOfStudy: string, // Non-law area of study

  // Optional
  region?: string,
  city?: string,
}
```

**Profession Options:**
- business_owner
- researcher
- journalist
- student (triggers education flow)
- legal_consultant
- government_official
- academic
- other (custom text input)

---

## Backend Endpoint Requirements

### Proposed Endpoint

```typescript
POST /api/onboarding/complete

// Request body matches OnboardingFormData type
interface OnboardingRequest {
  // Core fields (always present)
  userType: 'lawyer' | 'law_student' | 'other';
  communicationStyle: 'co_worker' | 'study_guide' | 'assistant';

  // Location (always present)
  country: string;
  countryCode: string;
  region?: string;
  city?: string;

  // Profile
  profession?: string;
  bio?: string;

  // Education
  studentEducationLevel?: 'university' | 'law_school';
  university?: string;
  level?: string;
  lawSchool?: string;
  yearOfCall?: number;
  areaOfStudy?: string;

  // Expertise (lawyers and law students only)
  areasOfExpertise?: number[];

  // Verification (lawyers only)
  callNumber?: string;
  wantsClientReferrals?: boolean;
}

// Response
interface OnboardingResponse {
  success: boolean;
  data: {
    profile: UserProfile;
    areas_of_expertise?: AreaOfExpertise[];
  };
}
```

### Backend Processing Logic

1. **Validate user type matches request data:**
   - Lawyer must have `areasOfExpertise`
   - Law student must have `studentEducationLevel` and education details
   - Other must have `profession`

2. **Derive profession if not provided:**
   ```typescript
   if (!profession) {
     if (userType === 'lawyer') profession = 'lawyer';
     else if (userType === 'law_student') profession = 'student';
   }
   ```

3. **Update user profile with snake_case field names:**
   ```typescript
   {
     user_type: userType,
     communication_style: communicationStyle,
     country,
     country_code: countryCode,
     region,
     city,
     profession,
     bio,
     university,
     level,
     law_school: lawSchool,
     call_to_bar_year: yearOfCall,
     area_of_study: areaOfStudy,
     call_number: callNumber,
     areas_of_expertise: areasOfExpertise,
   }
   ```

4. **Mark onboarding as complete:**
   - Could be inferred from `profession` field being set
   - Or explicit `onboarding_completed_at` timestamp

5. **Return updated user data**

---

## Data Validation Rules

### Required Fields by User Type

**Lawyer:**
- userType: 'lawyer'
- communicationStyle
- country, countryCode
- areasOfExpertise (must have at least 1)

**Law Student:**
- userType: 'law_student'
- communicationStyle
- country, countryCode
- studentEducationLevel
- university OR lawSchool (depending on studentEducationLevel)
- level (if studentEducationLevel === 'university')
- areasOfExpertise (must have at least 1)

**Other (Non-Student):**
- userType: 'other'
- communicationStyle
- country, countryCode
- profession

**Other (Student):**
- userType: 'other'
- communicationStyle
- country, countryCode
- profession: 'student'
- university
- level
- areaOfStudy

---

## Key Differences in User Flows

| Feature | Lawyer | Law Student | Other (Student) | Other (Non-Student) |
|---------|--------|-------------|-----------------|---------------------|
| Total Steps | 6-7 | 6-7 | 6 | 4 |
| Profile Step | Conditional | Conditional | Always | Always |
| Education Level | No | Yes | No | No |
| Education Details | No | Yes | Yes | No |
| Areas of Expertise | Yes | Yes | No | No |
| Verification | Optional | No | No | No |
| Area of Study | N/A | 'law' (auto) | User selects | N/A |
| Profession | 'lawyer' (auto) | 'student' (auto) | 'student' | User selects |

---

## Current Frontend Implementation

### Onboarding Submission Logic

Located in: `lib/hooks/useOnboarding.ts`

```typescript
// Frontend builds payload and calls authApi.updateProfile()
const payload = {
  user_type: data.userType,
  communication_style: data.communicationStyle,
  profession: profession || (derived from userType),
  country: data.country,
  country_code: data.countryCode,
  region: data.region,
  city: data.city,
  university: data.university,
  level: data.level,
  law_school: data.lawSchool,
  call_to_bar_year: data.yearOfCall,
  bio: data.bio,
  area_of_study: data.areaOfStudy,
  areas_of_expertise: data.areasOfExpertise,
  call_number: data.callNumber,
};

// Makes PUT/PATCH request to update profile
await authApi.updateProfile(payload);

// On success:
// 1. Updates local auth store
// 2. Sets onboardingComplete = true
// 3. Clears onboarding store
// 4. Redirects to home page
```

### State Management Flow

**During Onboarding:**
- Data stored in `lawexa-onboarding` localStorage
- Each step reads/writes to onboarding store
- Navigation guards check if previous steps completed

**On Submission:**
```typescript
submitOnboarding(formData) {
  // 1. Build payload with snake_case keys
  const payload = transformToSnakeCase(formData);

  // 2. Call backend
  const response = await authApi.updateProfile(payload);

  // 3. On success:
  if (response.success) {
    updateUser(response.data);
    setOnboardingComplete(true);
    onboardingStore.reset();
    window.location.href = '/';
  }
}
```

**After Completion:**
- `onboardingComplete` flag set to `true` in auth store
- `OnboardingGuard` checks this flag
- If false, redirects to `/onboarding`
- If true, allows access to main app

---

## Country-Specific Logic

### Level Formats
Different countries use different level naming:
- **Nigeria:** "100 Level", "200 Level", etc.
- **Ghana:** "Level 100", "Level 200", etc.
- **United States:** "Freshman", "Sophomore", etc.
- **United Kingdom:** "First Year", "Second Year", etc.
- **Default:** "Year 1", "Year 2", etc.

### Law School Options
Predefined law schools by country:
- **Nigeria:** 7 campuses of Nigerian Law School
- **Ghana:** Ghana School of Law
- **Other countries:** Free text input

---

## API Integration Points

### Existing APIs Used
1. **`GET /api/auth/me`** - Get user location
2. **`GET /api/countries`** - Get country list
3. **`GET /api/universities`** - Search universities
4. **`GET /api/areas-of-expertise`** - Get expertise list
5. **`PUT/PATCH /api/profile`** - Current onboarding submission endpoint
6. **`POST /api/lawyer-profiles`** - Create lawyer verification profile
7. **`POST /api/lawyer-profiles/{id}/documents`** - Upload verification docs
8. **`POST /api/lawyer-profiles/submit-for-verification`** - Submit for review

### New API Needed
**`POST /api/onboarding/complete`** - Replace current profile update for onboarding

---

## Backend Implementation Checklist

### 1. Endpoint Creation
- [ ] Create `POST /api/onboarding/complete` endpoint
- [ ] Accept OnboardingRequest body
- [ ] Validate required fields based on user type
- [ ] Handle profession derivation logic

### 2. Database Updates
- [ ] Update user profile table with onboarding fields
- [ ] Create/update user_expertise junction table
- [ ] Add `onboarding_completed_at` timestamp

### 3. Response Handling
- [ ] Return updated user profile
- [ ] Include areas_of_expertise in response
- [ ] Match current response structure from `updateProfile`

### 4. Validation Rules
- [ ] Validate user type consistency
- [ ] Validate required fields per user type
- [ ] Validate expertise IDs exist
- [ ] Validate country codes

### 5. Edge Cases
- [ ] Handle partial onboarding (user exits mid-flow)
- [ ] Handle re-onboarding if needed
- [ ] Handle custom profession values
- [ ] Handle custom university names
- [ ] Handle custom area of study values

---

## Summary

The onboarding flow is well-structured with clear user type differentiation. The backend endpoint should:

1. **Accept** a single comprehensive payload
2. **Validate** based on user type
3. **Transform** to snake_case for database
4. **Update** user profile and expertise
5. **Return** updated user data
6. **Mark** onboarding as complete

The frontend currently handles all the complex conditional logic and field derivation, which should be validated (but not duplicated) on the backend.
