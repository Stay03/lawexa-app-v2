'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Upload,
  FileText,
  X,
  BadgeCheck,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { useOnboardingStore } from '@/lib/stores/onboardingStore';
import { useOnboarding } from '@/lib/hooks/useOnboarding';
import { getTotalSteps } from '@/lib/utils/onboarding';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  label: string;
  description: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  accept?: string;
}

function FileUpload({
  label,
  description,
  file,
  onFileChange,
  accept = '.pdf,.jpg,.jpeg,.png',
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    onFileChange(selectedFile);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileChange(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 cursor-pointer transition-all',
        'hover:border-primary/50 hover:bg-primary/5',
        file ? 'border-primary bg-primary/5' : 'border-border'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
      {file ? (
        <>
          <FileText className="h-8 w-8 text-primary" />
          <span className="text-sm font-medium truncate max-w-full px-2">
            {file.name}
          </span>
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          <Upload className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground text-center">
            {description}
          </span>
        </>
      )}
    </div>
  );
}

export default function OnboardingStep5Page() {
  const router = useRouter();
  const {
    userType,
    communicationStyle,
    profileData,
    areasOfExpertise,
    verificationData,
    setVerificationData,
    setWantsClientReferrals,
  } = useOnboardingStore();
  const { submitOnboarding, isSubmitting } = useOnboarding();

  // Form state
  const [callNumber, setCallNumber] = useState(verificationData.callNumber || '');
  const [meansOfId, setMeansOfId] = useState<File | null>(null);
  const [callToBarCert, setCallToBarCert] = useState<File | null>(null);
  const [practicingLicense, setPracticingLicense] = useState<File | null>(null);
  const [cv, setCv] = useState<File | null>(null);

  // Redirect if previous steps not completed or not a lawyer
  useEffect(() => {
    if (!userType || !communicationStyle) {
      router.replace('/onboarding/step-1');
    } else if (userType !== 'lawyer') {
      router.replace('/onboarding/step-4');
    }
  }, [userType, communicationStyle, router]);

  const handleBack = () => {
    router.push('/onboarding/step-4');
  };

  const handleVerify = () => {
    // Save verification data
    setVerificationData({
      callNumber,
      meansOfId,
      callToBarCert,
      practicingLicense,
      cv,
    });
    setWantsClientReferrals(true);

    // TODO: When API is ready, upload files and submit verification
    // For now, just complete onboarding
    submitOnboarding({
      userType: userType!,
      communicationStyle: communicationStyle!,
      ...profileData,
      areasOfExpertise,
      callNumber,
      wantsClientReferrals: true,
    });
  };

  const handleSkip = () => {
    setWantsClientReferrals(false);

    // Complete onboarding without verification
    submitOnboarding({
      userType: userType!,
      communicationStyle: communicationStyle!,
      ...profileData,
      areasOfExpertise,
      wantsClientReferrals: false,
    });
  };

  const hasAnyDocument = meansOfId || callToBarCert || practicingLicense || cv || callNumber;

  if (!userType || userType !== 'lawyer') {
    return null;
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-8">
        <OnboardingProgress currentStep={5} totalSteps={getTotalSteps(userType)} />

        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-primary/10 p-3">
                <BadgeCheck className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Want clients to find you?
            </h1>
            <p className="text-muted-foreground">
              Get verified to receive client referrals from Lawexa
            </p>
          </div>

          {/* Verification benefits */}
          <div className="bg-primary/5 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Verified badge on your profile</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Get matched with potential clients</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Build trust with your credentials</span>
            </div>
          </div>

          {/* Verification form */}
          <div className="space-y-4">
            {/* Call Number */}
            <div className="space-y-2">
              <Label htmlFor="callNumber">Call Number / Enrollment Number</Label>
              <Input
                id="callNumber"
                value={callNumber}
                onChange={(e) => setCallNumber(e.target.value)}
                placeholder="e.g., SCN/12345"
              />
            </div>

            {/* File uploads - 2x2 grid */}
            <div className="grid grid-cols-2 gap-3">
              <FileUpload
                label="Means of ID"
                description="NIN, Passport, etc."
                file={meansOfId}
                onFileChange={setMeansOfId}
              />
              <FileUpload
                label="Call to Bar Certificate"
                description="PDF or Image"
                file={callToBarCert}
                onFileChange={setCallToBarCert}
              />
              <FileUpload
                label="Practicing License"
                description="Current license"
                file={practicingLicense}
                onFileChange={setPracticingLicense}
              />
              <FileUpload
                label="CV / Resume"
                description="PDF format"
                file={cv}
                onFileChange={setCv}
                accept=".pdf"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleVerify}
              disabled={!hasAnyDocument || isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <BadgeCheck className="mr-2 h-4 w-4" />
              )}
              Get Verified
            </Button>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={isSubmitting}
                className="flex-1"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                variant="outline"
                onClick={handleSkip}
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Skip for now
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            You can complete verification later from your profile settings
          </p>
        </div>
      </div>
    </div>
  );
}
