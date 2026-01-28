'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save } from 'lucide-react';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ProfileOverviewCard } from '@/components/settings/profile-overview-card';
import { UserTypeSwitcher } from '@/components/settings/user-type-switcher';
import { PersonalInfoForm } from '@/components/settings/personal-info-form';
import { ProfessionalInfoForm } from '@/components/settings/professional-info-form';
import { EducationInfoForm } from '@/components/settings/education-info-form';
import { SocialLinksForm } from '@/components/settings/social-links-form';
import {
  profileFormSchema,
  type ProfileFormValues,
} from '@/lib/utils/profile-validation';
import {
  getProfileFieldVisibility,
  inferStudentEducationLevel,
} from '@/lib/utils/profile-field-config';
import { useAuth } from '@/lib/hooks/useAuth';
import { useUpdateProfile } from '@/lib/hooks/useProfile';
import type { ProfileUpdatePayload } from '@/types/profile';
import type { UserType } from '@/types/auth';
import type { StudentEducationLevel } from '@/types/onboarding';

function ProfileSettingsPage() {
  const { user, isLoading } = useAuth();
  const updateProfile = useUpdateProfile();

  // Track whether the user has actively changed their type (to avoid clearing fields on initial load)
  const initialUserTypeRef = useRef<UserType | undefined>(undefined);
  const hasSetInitialType = useRef(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      bio: '',
      gender: '',
      date_of_birth: '',
      user_type: undefined,
      student_education_level: null,
      profession: '',
      country: '',
      state: '',
      city: '',
      address: '',
      areas_of_expertise: [],
      university: '',
      level: '',
      law_school: '',
      call_to_bar_year: '',
      call_number: '',
      other_certifications: '',
      work_experience: '',
      linkedin_url: '',
      website_url: '',
      twitter_url: '',
      facebook_url: '',
    },
  });

  // Watch fields needed for visibility computation
  const watchedUserType = form.watch('user_type') as UserType | undefined;
  const watchedStudentLevel = form.watch('student_education_level') as
    | StudentEducationLevel
    | null
    | undefined;
  const watchedProfession = form.watch('profession');

  // Compute field visibility
  const visibility = useMemo(
    () =>
      getProfileFieldVisibility(
        watchedUserType,
        watchedStudentLevel,
        watchedProfession
      ),
    [watchedUserType, watchedStudentLevel, watchedProfession]
  );

  // Pre-populate form when user data loads
  useEffect(() => {
    if (user) {
      const inferredLevel = inferStudentEducationLevel(
        user.profile?.user_type,
        user.profile?.university,
        user.profile?.law_school
      );

      initialUserTypeRef.current = user.profile?.user_type;
      hasSetInitialType.current = true;

      form.reset({
        name: user.name || '',
        bio: user.profile?.bio || '',
        gender: user.profile?.gender || '',
        date_of_birth: user.profile?.date_of_birth || '',
        user_type: user.profile?.user_type,
        student_education_level: inferredLevel,
        profession: user.profile?.profession || '',
        country: user.profile?.country || '',
        state: user.profile?.state || '',
        city: user.profile?.city || '',
        address: user.profile?.address || '',
        areas_of_expertise: user.areas_of_expertise?.map((e) => e.id) || [],
        university: user.profile?.university || '',
        level: user.profile?.level || '',
        law_school: user.profile?.law_school || '',
        call_to_bar_year: user.profile?.call_to_bar_year?.toString() || '',
        call_number: user.profile?.call_number || '',
        other_certifications: user.profile?.other_certifications || '',
        work_experience: user.profile?.work_experience || '',
        linkedin_url: user.profile?.linkedin_url || '',
        website_url: user.profile?.website_url || '',
        twitter_url: user.profile?.twitter_url || '',
        facebook_url: user.profile?.facebook_url || '',
      });
    }
  }, [user, form]);

  // Clear irrelevant fields when user type changes (only after initial load)
  useEffect(() => {
    if (!hasSetInitialType.current) return;
    if (watchedUserType === initialUserTypeRef.current) return;

    if (watchedUserType === 'lawyer') {
      form.setValue('university', '', { shouldDirty: true });
      form.setValue('level', '', { shouldDirty: true });
      form.setValue('student_education_level', null);
    } else if (watchedUserType === 'law_student') {
      form.setValue('call_number', '', { shouldDirty: true });
      form.setValue('other_certifications', '', { shouldDirty: true });
      form.setValue('work_experience', '', { shouldDirty: true });
      form.setValue('call_to_bar_year', '', { shouldDirty: true });
    } else if (watchedUserType === 'other') {
      form.setValue('call_number', '', { shouldDirty: true });
      form.setValue('call_to_bar_year', '', { shouldDirty: true });
      form.setValue('other_certifications', '', { shouldDirty: true });
      form.setValue('work_experience', '', { shouldDirty: true });
      form.setValue('areas_of_expertise', [], { shouldDirty: true });
      form.setValue('student_education_level', null);
    }
  }, [watchedUserType, form]);

  // Clear fields when student education level changes
  useEffect(() => {
    if (!hasSetInitialType.current) return;
    if (watchedUserType !== 'law_student') return;

    if (watchedStudentLevel === 'university') {
      form.setValue('law_school', '', { shouldDirty: true });
    } else if (watchedStudentLevel === 'law_school') {
      form.setValue('university', '', { shouldDirty: true });
      form.setValue('level', '', { shouldDirty: true });
    }
  }, [watchedStudentLevel, watchedUserType, form]);

  function onSubmit(values: ProfileFormValues) {
    const payload: ProfileUpdatePayload = {};

    // Always include these
    if (values.name) payload.name = values.name;
    if (values.bio) payload.bio = values.bio;
    if (values.gender) payload.gender = values.gender;
    if (values.date_of_birth) payload.date_of_birth = values.date_of_birth;
    if (values.country) payload.country = values.country;
    if (values.state) payload.state = values.state;
    if (values.city) payload.city = values.city;
    if (values.address) payload.address = values.address;
    if (values.linkedin_url) payload.linkedin_url = values.linkedin_url;
    if (values.website_url) payload.website_url = values.website_url;
    if (values.twitter_url) payload.twitter_url = values.twitter_url;
    if (values.facebook_url) payload.facebook_url = values.facebook_url;

    // Include user_type if changed
    if (values.user_type) {
      payload.user_type = values.user_type;

      // Auto-set profession for lawyer/law_student
      if (values.user_type === 'lawyer') {
        payload.profession = 'lawyer';
      } else if (values.user_type === 'law_student') {
        payload.profession = 'student';
      }
    }

    // Only include fields that are visible for the current user type
    if (visibility.showProfession && values.profession) {
      payload.profession = values.profession;
    }

    if (visibility.showUniversity && values.university) {
      payload.university = values.university;
    }
    if (visibility.showLevel && values.level) {
      payload.level = values.level;
    }
    if (visibility.showLawSchool && values.law_school) {
      payload.law_school = values.law_school;
    }
    if (visibility.showCallToBarYear && values.call_to_bar_year) {
      payload.call_to_bar_year = parseInt(values.call_to_bar_year, 10);
    }
    if (visibility.showCallNumber && values.call_number) {
      payload.call_number = values.call_number;
    }
    if (visibility.showOtherCertifications && values.other_certifications) {
      payload.other_certifications = values.other_certifications;
    }
    if (visibility.showWorkExperience && values.work_experience) {
      payload.work_experience = values.work_experience;
    }
    if (
      visibility.showAreasOfExpertise &&
      values.areas_of_expertise &&
      values.areas_of_expertise.length > 0
    ) {
      payload.areas_of_expertise = values.areas_of_expertise;
    }

    updateProfile.mutate(payload);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-60 w-full rounded-xl" />
        <Skeleton className="h-60 w-full rounded-xl" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <ProfileOverviewCard user={user} />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <UserTypeSwitcher form={form} />
          <PersonalInfoForm form={form} />
          <ProfessionalInfoForm form={form} visibility={visibility} />
          <EducationInfoForm form={form} visibility={visibility} />
          <SocialLinksForm form={form} />

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!form.formState.isDirty || updateProfile.isPending}
            >
              <Save className="h-4 w-4" />
              {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default ProfileSettingsPage;
