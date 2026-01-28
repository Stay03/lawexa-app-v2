'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save } from 'lucide-react';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ProfileOverviewCard } from '@/components/settings/profile-overview-card';
import { PersonalInfoForm } from '@/components/settings/personal-info-form';
import { ProfessionalInfoForm } from '@/components/settings/professional-info-form';
import { EducationInfoForm } from '@/components/settings/education-info-form';
import { SocialLinksForm } from '@/components/settings/social-links-form';
import {
  profileFormSchema,
  type ProfileFormValues,
} from '@/lib/utils/profile-validation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useUpdateProfile } from '@/lib/hooks/useProfile';
import type { ProfileUpdatePayload } from '@/types/profile';

function ProfileSettingsPage() {
  const { user, isLoading } = useAuth();
  const updateProfile = useUpdateProfile();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      bio: '',
      gender: '',
      date_of_birth: '',
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

  // Pre-populate form when user data loads
  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name || '',
        bio: user.profile?.bio || '',
        gender: user.profile?.gender || '',
        date_of_birth: user.profile?.date_of_birth || '',
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

  function onSubmit(values: ProfileFormValues) {
    const payload: ProfileUpdatePayload = {};

    // Only include non-empty values
    if (values.name) payload.name = values.name;
    if (values.bio) payload.bio = values.bio;
    if (values.gender) payload.gender = values.gender;
    if (values.date_of_birth) payload.date_of_birth = values.date_of_birth;
    if (values.profession) payload.profession = values.profession;
    if (values.country) payload.country = values.country;
    if (values.state) payload.state = values.state;
    if (values.city) payload.city = values.city;
    if (values.address) payload.address = values.address;
    if (values.university) payload.university = values.university;
    if (values.level) payload.level = values.level;
    if (values.law_school) payload.law_school = values.law_school;
    if (values.call_number) payload.call_number = values.call_number;
    if (values.other_certifications)
      payload.other_certifications = values.other_certifications;
    if (values.work_experience)
      payload.work_experience = values.work_experience;
    if (values.linkedin_url) payload.linkedin_url = values.linkedin_url;
    if (values.website_url) payload.website_url = values.website_url;
    if (values.twitter_url) payload.twitter_url = values.twitter_url;
    if (values.facebook_url) payload.facebook_url = values.facebook_url;

    if (values.call_to_bar_year) {
      payload.call_to_bar_year = parseInt(values.call_to_bar_year, 10);
    }

    if (values.areas_of_expertise && values.areas_of_expertise.length > 0) {
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
          <PersonalInfoForm form={form} />
          <ProfessionalInfoForm form={form} />
          <EducationInfoForm form={form} />
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
